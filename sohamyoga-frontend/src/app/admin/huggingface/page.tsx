'use client';

import { useState, useEffect } from 'react';

interface HFJob {
  id: number;
  job_number: string;
  task_type: string;
  model_id: string;
  input_text: string | null;
  input_image_url: string | null;
  parameters: string | null;
  status: string;
  output_text: string | null;
  output_url: string | null;
  inference_time_ms: number | null;
  created_at: string;
}

interface HFModel {
  id: string;
  task: string;
  description: string;
}

const TASK_MODELS: Record<string, HFModel[]> = {
  'Text Generation': [
    { id: 'mistralai/Mistral-7B-Instruct-v0.3', task: 'text-generation', description: 'Mistral 7B Instruct' },
    { id: 'meta-llama/Llama-3.2-3B-Instruct', task: 'text-generation', description: 'Llama 3.2 3B' },
    { id: 'HuggingFaceH4/zephyr-7b-beta', task: 'text-generation', description: 'Zephyr 7B' },
  ],
  'Image Generation': [
    { id: 'stabilityai/stable-diffusion-xl-base-1.0', task: 'text-to-image', description: 'SDXL Base 1.0' },
    { id: 'black-forest-labs/FLUX.1-dev', task: 'text-to-image', description: 'FLUX.1 Dev' },
    { id: 'stabilityai/stable-diffusion-3-medium-diffusers', task: 'text-to-image', description: 'SD3 Medium' },
  ],
  'Image Classification': [
    { id: 'google/vit-base-patch16-224', task: 'image-classification', description: 'ViT Base' },
    { id: 'microsoft/resnet-50', task: 'image-classification', description: 'ResNet-50' },
  ],
  'Object Detection': [
    { id: 'facebook/detr-resnet-50', task: 'object-detection', description: 'DETR ResNet-50' },
    { id: 'hustvl/yolos-small', task: 'object-detection', description: 'YOLOS Small' },
  ],
  'Text Summarization': [
    { id: 'facebook/bart-large-cnn', task: 'summarization', description: 'BART Large CNN' },
    { id: 'google/pegasus-xsum', task: 'summarization', description: 'Pegasus XSum' },
  ],
  'Sentiment Analysis': [
    { id: 'cardiffnlp/twitter-roberta-base-sentiment-latest', task: 'text-classification', description: 'RoBERTa Sentiment' },
    { id: 'distilbert/distilbert-base-uncased-finetuned-sst-2-english', task: 'text-classification', description: 'DistilBERT SST-2' },
  ],
  'Translation': [
    { id: 'Helsinki-NLP/opus-mt-en-fr', task: 'translation', description: 'EN → FR' },
    { id: 'Helsinki-NLP/opus-mt-en-es', task: 'translation', description: 'EN → ES' },
    { id: 'Helsinki-NLP/opus-mt-en-hi', task: 'translation', description: 'EN → HI' },
  ],
};

export default function HuggingFacePage() {
  const [jobs, setJobs] = useState<HFJob[]>([]);
  const [activeTab, setActiveTab] = useState<'run' | 'history' | 'models' | 'settings'>('run');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [taskType, setTaskType] = useState('Text Generation');
  const [selectedModel, setSelectedModel] = useState(TASK_MODELS['Text Generation'][0].id);
  const [inputText, setInputText] = useState('');
  const [inputImageUrl, setInputImageUrl] = useState('');
  const [result, setResult] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const models = TASK_MODELS[taskType] || [];

  useEffect(() => {
    fetch('/api/admin/huggingface')
      .then(r => r.json())
      .then(d => { setJobs(d.items || []); setApiKeySet(d.api_key_set || false); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const first = (TASK_MODELS[taskType] || [])[0];
    if (first) setSelectedModel(first.id);
  }, [taskType]);

  const run = async () => {
    if (!inputText.trim() && !inputImageUrl.trim()) return;
    setRunning(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/huggingface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_type: taskType, model_id: selectedModel, input_text: inputText || null, input_image_url: inputImageUrl || null }),
      });
      const d = await res.json();
      if (d.output_text) setResult(d.output_text);
      else if (d.output_url) setResult(`Output: ${d.output_url}`);
      else setResult(d.error || d.message || 'Job submitted');
      setJobs(prev => [d.job, ...prev].filter(Boolean));
    } catch { setResult('Request failed'); } finally { setRunning(false); }
  };

  const saveKey = async () => {
    setSavingKey(true);
    try {
      await fetch('/api/admin/huggingface', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_api_key', api_key: apiKey }) });
      setApiKeySet(true);
      setApiKey('');
    } finally { setSavingKey(false); }
  };

  const statusColor = (s: string) => ({ queued: 'bg-yellow-100 text-yellow-700', running: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100 text-gray-600');
  const needsImageInput = taskType === 'Image Classification' || taskType === 'Object Detection';
  const needsTextInput = !needsImageInput;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HuggingFace Integration</h1>
          <p className="text-gray-600 mt-1">Run inference on 500,000+ open-source AI models — text, image, translation, sentiment</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${apiKeySet ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {apiKeySet ? 'API Key Set' : 'No API Key'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Runs', value: jobs.length, color: 'bg-orange-500' },
          { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: 'bg-green-500' },
          { label: 'Models Used', value: new Set(jobs.map(j => j.model_id)).size, color: 'bg-blue-500' },
          { label: 'Failed', value: jobs.filter(j => j.status === 'failed').length, color: 'bg-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['run', 'history', 'models', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'run' ? 'Run Inference' : t === 'history' ? 'Run History' : t === 'models' ? 'Model Catalog' : 'Settings'}
          </button>
        ))}
      </div>

      {activeTab === 'run' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          {!apiKeySet && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              Set your HuggingFace API key in Settings to run models. Free tier: 1000 requests/day.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
              <select value={taskType} onChange={e => setTaskType(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                {Object.keys(TASK_MODELS).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                {models.map(m => <option key={m.id} value={m.id}>{m.description} — {m.id}</option>)}
              </select>
            </div>
          </div>
          {needsTextInput && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Input Text</label>
              <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder={taskType === 'Image Generation' ? 'Describe the image to generate...' : taskType === 'Translation' ? 'Enter text to translate...' : taskType === 'Text Summarization' ? 'Paste article or long text to summarize...' : 'Enter your prompt...'} className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          )}
          {needsImageInput && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input value={inputImageUrl} onChange={e => setInputImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={run} disabled={running || (!inputText.trim() && !inputImageUrl.trim())} className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
              {running ? 'Running...' : 'Run Inference'}
            </button>
          </div>
          {result && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-xs font-medium text-orange-700 mb-1">Output</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{result}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">Inference History</h2></div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No runs yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['#', 'Task', 'Model', 'Input', 'Output', 'Time (ms)', 'Status', 'When'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium text-xs">{h}</th>)}</tr></thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{j.job_number}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{j.task_type}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{j.model_id}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{j.input_text || j.input_image_url || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{j.output_text || j.output_url || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{j.inference_time_ms ?? '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(j.status)}`}>{j.status}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'models' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Supported Model Catalog</h2>
          <div className="space-y-4">
            {Object.entries(TASK_MODELS).map(([task, mods]) => (
              <div key={task} className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-900 mb-2">{task}</p>
                <div className="space-y-1">
                  {mods.map(m => (
                    <div key={m.id} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-700 font-medium">{m.description}</span>
                      <span className="text-gray-400 font-mono text-xs">{m.id}</span>
                      <button onClick={() => { setTaskType(task); setSelectedModel(m.id); setActiveTab('run'); }} className="text-xs text-orange-600 hover:underline ml-auto">Use →</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">HuggingFace API Settings</h2>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            Get your free API key at <span className="font-mono">huggingface.co/settings/tokens</span>. Free tier allows 1,000 requests/day. PRO tier unlocks faster inference and private models.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HuggingFace API Key {apiKeySet && <span className="text-green-600 font-normal">(currently set)</span>}</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="hf_xxxxxxxxxxxxxxxxxxxx" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <button onClick={saveKey} disabled={savingKey || !apiKey.trim()} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50">{savingKey ? 'Saving...' : 'Save API Key'}</button>
        </div>
      )}
    </div>
  );
}
