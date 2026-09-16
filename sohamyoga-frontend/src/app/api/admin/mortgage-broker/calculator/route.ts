import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.price || !b.rate || !b.amortization) {
    return Response.json({ error: 'price, rate, and amortization are required.' }, { status: 400 });
  }

  const price = Number(b.price);
  const downPayment = Number(b.down_payment ?? 0);
  const rate = Number(b.rate); // annual rate as percentage e.g. 5.25
  const amortizationYears = Number(b.amortization);
  const frequency: string = b.frequency ?? 'monthly';

  if (price <= 0 || rate <= 0 || amortizationYears <= 0) {
    return Response.json({ error: 'price, rate, and amortization must be positive.' }, { status: 400 });
  }

  const downPct = price > 0 ? (downPayment / price) * 100 : 0;
  let mortgageAmount = price - downPayment;

  // CMHC premium calculation
  let cmhcPremium = 0;
  let cmhcInsured = false;
  if (price <= 1500000 && downPct >= 5 && downPct < 20) {
    cmhcInsured = true;
    const ltvPct = (mortgageAmount / price) * 100;
    let premiumRate = 0;
    if (ltvPct <= 80) premiumRate = 0;
    else if (ltvPct <= 85) premiumRate = 0.028;
    else if (ltvPct <= 90) premiumRate = 0.031;
    else premiumRate = 0.04;
    cmhcPremium = mortgageAmount * premiumRate;
    mortgageAmount += cmhcPremium;
  }

  // Payment frequency factor
  let paymentsPerYear = 12;
  let periodsPerYear = 12;
  if (frequency === 'bi_weekly') { paymentsPerYear = 26; periodsPerYear = 26; }
  else if (frequency === 'accelerated_bi_weekly') { paymentsPerYear = 26; periodsPerYear = 24; } // accelerated = monthly/2 * 26
  else if (frequency === 'weekly') { paymentsPerYear = 52; periodsPerYear = 52; }

  // Canadian mortgage rate compounding: semi-annual compounding (not monthly)
  const semiAnnualRate = rate / 100 / 2;
  const effectiveAnnualRate = Math.pow(1 + semiAnnualRate, 2) - 1;
  const periodicRate = Math.pow(1 + effectiveAnnualRate, 1 / periodsPerYear) - 1;
  const totalPeriods = amortizationYears * periodsPerYear;

  let payment: number;
  if (periodicRate === 0) {
    payment = mortgageAmount / totalPeriods;
  } else {
    payment = (mortgageAmount * periodicRate * Math.pow(1 + periodicRate, totalPeriods)) /
      (Math.pow(1 + periodicRate, totalPeriods) - 1);
  }

  // For accelerated bi-weekly: take monthly payment / 2 (pays more than standard bi-weekly)
  let actualPayment = payment;
  if (frequency === 'accelerated_bi_weekly') {
    const monthlyRate = Math.pow(1 + effectiveAnnualRate, 1 / 12) - 1;
    const monthlyPayment = (mortgageAmount * monthlyRate * Math.pow(1 + monthlyRate, amortizationYears * 12)) /
      (Math.pow(1 + monthlyRate, amortizationYears * 12) - 1);
    actualPayment = monthlyPayment / 2;
  }

  const totalCost = actualPayment * paymentsPerYear * amortizationYears;
  const totalInterest = totalCost - mortgageAmount;

  // GDS/TDS ratio (use annual income if provided)
  const annualIncome = b.annual_income ? Number(b.annual_income) : null;
  const monthlyPaymentEquiv = frequency === 'monthly' ? actualPayment
    : frequency === 'bi_weekly' || frequency === 'accelerated_bi_weekly' ? actualPayment * 26 / 12
    : actualPayment * 52 / 12;

  const propertyTax = b.property_tax ? Number(b.property_tax) : price * 0.0085 / 12; // estimate 0.85% annual
  const heatingCost = b.heating_cost ? Number(b.heating_cost) : 150; // monthly estimate
  const condoFees = b.condo_fees ? Number(b.condo_fees) : 0;

  let gdsRatio: number | null = null;
  let tdsRatio: number | null = null;
  if (annualIncome && annualIncome > 0) {
    const monthlyIncome = annualIncome / 12;
    const monthlyObligations = b.monthly_obligations ? Number(b.monthly_obligations) : 0;
    gdsRatio = ((monthlyPaymentEquiv + propertyTax + heatingCost + condoFees * 0.5) / monthlyIncome) * 100;
    tdsRatio = ((monthlyPaymentEquiv + propertyTax + heatingCost + condoFees * 0.5 + monthlyObligations) / monthlyIncome) * 100;
  }

  // Amortization schedule — first 12 payments
  const schedule: { period: number; payment: number; principal: number; interest: number; balance: number }[] = [];
  let balance = mortgageAmount;
  const schedRate = frequency === 'accelerated_bi_weekly'
    ? Math.pow(1 + effectiveAnnualRate, 1 / 24) - 1
    : periodicRate;

  for (let i = 1; i <= Math.min(12, totalPeriods); i++) {
    const interestPortion = balance * schedRate;
    const principalPortion = actualPayment - interestPortion;
    balance = Math.max(0, balance - principalPortion);
    schedule.push({
      period: i,
      payment: Math.round(actualPayment * 100) / 100,
      principal: Math.round(principalPortion * 100) / 100,
      interest: Math.round(interestPortion * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }

  return Response.json({
    inputs: { price, down_payment: downPayment, down_pct: Math.round(downPct * 100) / 100, rate, amortization_years: amortizationYears, frequency },
    mortgage_amount: Math.round(mortgageAmount * 100) / 100,
    cmhc_insured: cmhcInsured,
    cmhc_premium: Math.round(cmhcPremium * 100) / 100,
    payment: Math.round(actualPayment * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    total_interest: Math.round(totalInterest * 100) / 100,
    gds_ratio: gdsRatio !== null ? Math.round(gdsRatio * 100) / 100 : null,
    tds_ratio: tdsRatio !== null ? Math.round(tdsRatio * 100) / 100 : null,
    gds_pass: gdsRatio !== null ? gdsRatio <= 39 : null,
    tds_pass: tdsRatio !== null ? tdsRatio <= 44 : null,
    schedule_first_12: schedule,
  });
}
