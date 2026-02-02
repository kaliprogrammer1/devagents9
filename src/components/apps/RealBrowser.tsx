"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Globe, ArrowLeft, ArrowRight, RotateCw, Home, Search, Lock, AlertTriangle, ExternalLink, Cpu, Layout, Eye, MousePointer2, ScanSearch } from 'lucide-react';

export interface BrowserHandle {
  navigate: (url: string) => void;
  getUrl: () => string;
  getTitle: () => string;
  search: (query: string) => void;
  scroll: (direction: 'up' | 'down', amount?: number) => void;
  getSnapshot: () => Promise<string>;
  analyze: () => Promise<any>;
}

interface RealBrowserProps {
  initialUrl?: string;
  onNavigate?: (url: string, title: string) => void;
  onLoad?: (url: string, title: string) => void;
  disabled?: boolean;
}

const HOMEPAGE = 'https://www.google.com';

const RealBrowser = forwardRef<BrowserHandle, RealBrowserProps>(({
  initialUrl = HOMEPAGE,
  onNavigate,
  onLoad,
  disabled = false,
}, ref) => {
  const [url, setUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('New Tab');
  const [isSecure, setIsSecure] = useState(true);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'visual' | 'agent' | 'analysis'>('visual');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const navigateToUrl = useCallback(async (targetUrl: string) => {
    let normalizedUrl = targetUrl.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl;
    
    setIsLoading(true);
    setUrl(normalizedUrl);
    setInputUrl(normalizedUrl);
    setIsSecure(normalizedUrl.startsWith('https://'));
    onNavigate?.(normalizedUrl, title);

    try {
      const res = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'open', args: [normalizedUrl] }),
      });
      const data = await res.json();
      
      if (data.success) {
        // Automatically fetch a screenshot and snapshot to keep the view in sync
        const [snapRes, screenRes] = await Promise.all([
          fetch('/api/browser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'snapshot', args: ['-i'] }),
          }),
          fetch('/api/browser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'screenshot' }),
          })
        ]);
        
        const snapData = await snapRes.json();
        const screenData = await screenRes.json();
        
        if (snapData.success) setSnapshot(snapData.data);
        if (screenData.success) setSnapshotUrl(screenData.data);
      }
    } catch (err) {
      console.error('Agent browser error:', err);
    }
    
    setIsLoading(false);
  }, [title, onNavigate]);

  const analyzePage = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'snapshot', args: ['-i', '--json'] }),
      });
      const data = await res.json();
      if (data.success) {
        // Parse the snapshot into metadata for the analysis view
        const tree = JSON.parse(data.data);
        const extractedMetadata: any[] = [];
        
        const flatten = (node: any) => {
          if (node.ref && (node.role === 'button' || node.role === 'link' || node.role === 'textbox')) {
            extractedMetadata.push({
              type: node.role,
              text: node.name || node.text || node.placeholder,
              ref: node.ref,
              x: node.box?.x || Math.random() * 500,
              y: node.box?.y || Math.random() * 300,
              w: node.box?.w || 100,
              h: node.box?.h || 30
            });
          }
          if (node.children) node.children.forEach(flatten);
        };
        
        flatten(tree);
        setMetadata(extractedMetadata.length > 0 ? extractedMetadata : metadata);
        setViewMode('analysis');
      }
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [metadata]);

  useImperativeHandle(ref, () => ({
    navigate: (newUrl: string) => navigateToUrl(newUrl),
    getUrl: () => url,
    getTitle: () => title,
    search: (query: string) => {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      navigateToUrl(searchUrl);
    },
    scroll: (direction: 'up' | 'down', amount = 300) => {
      if (iframeRef.current?.contentWindow) {
        try {
          const scrollAmount = direction === 'down' ? amount : -amount;
          iframeRef.current.contentWindow.scrollBy(0, scrollAmount);
        } catch {
          console.log('Cannot scroll iframe due to CORS');
        }
      }
    },
    getSnapshot: async () => {
      const res = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'snapshot', args: ['-i'] }),
      });
      const data = await res.json();
      return data.data;
    },
    analyze: analyzePage
  }), [url, title, navigateToUrl, analyzePage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim() && !disabled) {
      navigateToUrl(inputUrl);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden font-sans">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200">
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded hover:bg-slate-200 transition-colors"><ArrowLeft size={16} className="text-slate-600" /></button>
          <button className="p-1.5 rounded hover:bg-slate-200 transition-colors"><ArrowRight size={16} className="text-slate-600" /></button>
          <button className="p-1.5 rounded hover:bg-slate-200 transition-colors"><RotateCw size={16} className={`text-slate-600 ${isLoading ? 'animate-spin' : ''}`} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1">
          <div className="flex items-center bg-white rounded-xl px-3 py-1.5 border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
            {isSecure ? <Lock size={14} className="text-emerald-500 mr-2" /> : <AlertTriangle size={14} className="text-amber-500 mr-2" />}
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Search or enter URL"
              disabled={disabled}
              className="flex-1 bg-transparent text-slate-800 text-sm outline-none placeholder-slate-400"
            />
          </div>
        </form>

        <div className="flex items-center gap-1 bg-slate-200/50 rounded-lg p-1">
          <button 
            onClick={() => setViewMode('visual')}
            title="Visual View"
            className={`p-1.5 rounded-md transition-all ${viewMode === 'visual' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Layout size={14} />
          </button>
          <button 
            onClick={() => setViewMode('agent')}
            title="Agent Semantic View"
            className={`p-1.5 rounded-md transition-all ${viewMode === 'agent' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Eye size={14} />
          </button>
          <button 
            onClick={analyzePage}
            title="Visual Analysis"
            className={`p-1.5 rounded-md transition-all ${viewMode === 'analysis' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <ScanSearch size={14} />
          </button>
        </div>
      </div>

        <div className="flex-1 relative bg-white overflow-hidden">
          {viewMode === 'visual' && (
            <div className="w-full h-full relative">
              {snapshotUrl ? (
                <div className="w-full h-full relative group">
                  <img 
                    src={snapshotUrl} 
                    alt="Live Browser View" 
                    className="w-full h-full object-contain bg-slate-100"
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-full shadow-lg font-bold">
                      LIVE PROXY VIEW
                    </span>
                  </div>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  src={url}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
                  onLoad={() => setIsLoading(false)}
                  title="Browser"
                />
              )}
            </div>
          )}

        {viewMode === 'agent' && (
          <div className="h-full bg-slate-900 p-4 font-mono text-xs overflow-auto text-emerald-400">
            <div className="flex items-center gap-2 text-purple-400 mb-4 border-b border-purple-500/30 pb-2">
              <Cpu size={14} />
              <span className="font-bold uppercase tracking-wider">Agent Semantic View</span>
            </div>
            {snapshot ? (
              <pre className="whitespace-pre-wrap">{snapshot}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Cpu size={32} className="mb-2 animate-pulse" />
                <p>Waiting for agent interaction...</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'analysis' && (
          <div className="h-full bg-slate-50 p-4 overflow-auto">
            <div className="flex items-center justify-between text-emerald-600 mb-4 border-b border-emerald-200 pb-2">
              <div className="flex items-center gap-2">
                <ScanSearch size={14} />
                <span className="font-bold uppercase tracking-wider text-xs">Visual LLM Analysis</span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 px-2 py-0.5 rounded-full">OCR READY</span>
            </div>
            
            <div className="relative border border-slate-200 rounded-xl bg-white aspect-video shadow-inner overflow-hidden">
              <div className="absolute inset-0 bg-slate-100 flex items-center justify-center text-slate-300">
                <p className="text-xs italic">Visual representation of interactive elements</p>
              </div>
              {metadata.map((item, i) => (
                <div 
                  key={i}
                  className="absolute border border-emerald-500 bg-emerald-500/10 flex items-center justify-center group cursor-help transition-all hover:bg-emerald-500/20"
                  style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
                >
                  <span className="text-[8px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 px-1 rounded -top-4 absolute whitespace-nowrap">
                    {item.type}: {item.text || item.placeholder}
                  </span>
                  <MousePointer2 size={10} className="text-emerald-500 opacity-30" />
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2">
              {metadata.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-100 hover:border-emerald-200 transition-colors shadow-sm">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-400">
                    <span className="text-[10px] font-bold">{i+1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-slate-700">{item.type.toUpperCase()}</div>
                    <div className="text-xs text-slate-500">{item.text || item.placeholder}</div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    ({item.x}, {item.y})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-slate-500 text-sm font-medium">Processing...</span>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-medium">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Globe size={10} /> {new URL(url).hostname}</span>
          {disabled && <span className="text-purple-600 flex items-center gap-1"><Cpu size={10} /> Agent Controlled</span>}
        </div>
        <div className="flex items-center gap-1">
          <ExternalLink size={10} />
          <span>v2.1 RealWeb Visual</span>
        </div>
      </div>
    </div>
  );
});

RealBrowser.displayName = 'RealBrowser';

export default RealBrowser;
