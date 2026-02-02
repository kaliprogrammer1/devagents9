"use client";

import { useState, useEffect } from 'react';
import { Play, Square, Save, X, Plus, Trash2, ChevronRight, Brain, Zap } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/workspaceStore';

interface SkillRecorderPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SkillRecorderPanel({ isOpen, onClose }: SkillRecorderPanelProps) {
  const { isRecordingSkill, recordedActions, startRecordingSkill, stopRecordingSkill } = useWorkspaceStore();
  const [title, setTitle] = useState('');
  const [trigger, setTrigger] = useState('');
  const [saving, setSaving] = useState(false);

  const handleStart = () => {
    startRecordingSkill();
  };

  const handleStop = async () => {
    if (!title.trim() || !trigger.trim()) {
      alert('Please provide a title and trigger condition for this skill.');
      return;
    }
    setSaving(true);
    try {
      await stopRecordingSkill(title, trigger);
      setTitle('');
      setTrigger('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f17] border border-white/10 rounded-xl w-[500px] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Brain className="text-purple-400" size={24} />
            <h2 className="text-white font-semibold text-lg">Skill Recorder</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} className="text-white/60" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!isRecordingSkill ? (
            <div className="space-y-4">
              <div className="text-white/60 text-sm">
                Record a sequence of actions to teach the agent a new "Skill". These are saved to <code className="bg-white/10 px-1 rounded text-cyan-300">skills.md</code> and are persistent across sessions.
              </div>
              <button
                onClick={handleStart}
                className="w-full py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-xl border border-purple-500/30 flex items-center justify-center gap-3 transition-all group"
              >
                <div className="w-4 h-4 bg-red-500 rounded-full group-hover:animate-pulse" />
                <span className="font-semibold">Start Recording Actions</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-400">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold uppercase tracking-wider">Recording...</span>
                </div>
                <div className="text-white/40 text-xs">{recordedActions.length} actions captured</div>
              </div>

              <div className="bg-[#1a1a2e] rounded-lg border border-white/5 p-4 max-h-[200px] overflow-y-auto space-y-2">
                {recordedActions.length === 0 ? (
                  <div className="text-white/20 text-center py-4 text-xs italic">Perform actions in the room or computer to see them appear here...</div>
                ) : (
                  recordedActions.map((action, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-cyan-300/80 font-mono">
                      <ChevronRight size={12} className="text-white/20" />
                      {action}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="space-y-1">
                  <label className="text-white/60 text-xs font-medium">Skill Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g., Optimize React Components"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/40 outline-none focus:border-purple-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-white/60 text-xs font-medium">Trigger Phrase (When should the agent use this?)</label>
                  <input
                    type="text"
                    value={trigger}
                    onChange={e => setTrigger(e.target.value)}
                    placeholder="e.g., when asked to improve performance"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/40 outline-none focus:border-purple-500/50"
                  />
                </div>
                <button
                  onClick={handleStop}
                  disabled={saving || recordedActions.length === 0}
                  className="w-full py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg border border-emerald-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {saving ? <Plus size={18} className="animate-spin" /> : <Save size={18} />}
                  <span className="font-semibold">Save New Skill</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
