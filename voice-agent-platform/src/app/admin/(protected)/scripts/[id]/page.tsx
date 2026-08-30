import { notFound } from 'next/navigation';
import { getScript, listVersions } from '@/domain/script/repository';
import ScriptVersionActions from './ScriptVersionActions';
import NewDraftVersionForm from './NewDraftVersionForm';

export const dynamic = 'force-dynamic';

export default async function ScriptDetailPage({ params }: { params: { id: string } }) {
  const script = await getScript(params.id);
  if (!script) notFound();
  const scriptJson = script.toJSON();
  const versions = await listVersions(params.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{scriptJson.name}</h1>
        <p className="text-sm opacity-60 capitalize">{scriptJson.serviceType.replace('_', ' ')}</p>
      </div>

      <div className="space-y-3">
        <h2 className="font-medium">Versions</h2>
        {versions.map((v) => {
          const vJson = v.toJSON();
          return (
            <div key={vJson.id} className="border border-black/10 dark:border-white/10 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">v{vJson.versionNumber}</span>
                <span className="text-xs px-2 py-0.5 rounded-full capitalize border border-black/20 dark:border-white/20">
                  {vJson.status}
                </span>
              </div>
              <div className="text-sm space-y-1">
                <p><span className="opacity-60">Opening: </span>{vJson.sections.opening}</p>
                {vJson.sections.discoveryQuestions.length > 0 && (
                  <div>
                    <span className="opacity-60">Discovery questions:</span>
                    <ul className="list-disc list-inside">
                      {vJson.sections.discoveryQuestions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                )}
                {vJson.sections.objectionHandling && <p><span className="opacity-60">Objection handling: </span>{vJson.sections.objectionHandling}</p>}
                <p><span className="opacity-60">Closing: </span>{vJson.sections.closing}</p>
              </div>
              {vJson.status === 'draft' && <ScriptVersionActions scriptId={scriptJson.id} versionId={vJson.id} />}
            </div>
          );
        })}
      </div>

      <NewDraftVersionForm scriptId={scriptJson.id} />
    </div>
  );
}
