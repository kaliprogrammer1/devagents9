"use client";

import React from 'react';
import { RoomConfig, ROOMS } from '@/lib/rooms';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface RoomSelectorProps {
  currentRoomId: string;
  onRoomChange: (roomId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function RoomSelector({
  currentRoomId,
  onRoomChange,
  isOpen,
  onToggle
}: RoomSelectorProps) {
  return (
    <div 
      className={`fixed left-0 top-0 h-full z-50 transition-all duration-500 ease-in-out flex ${
        isOpen ? 'translate-x-0' : '-translate-x-[calc(100%-12px)]'
      }`}
    >
      <div className="w-64 bg-[#0a0a0f]/90 backdrop-blur-xl border-r border-white/10 p-4 flex flex-col gap-4 shadow-2xl overflow-y-auto">
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
          <h2 className="text-white/70 text-xs font-bold uppercase tracking-widest">Workspace Nodes</h2>
        </div>
        
        <div className="flex flex-col gap-3">
          {ROOMS.map((room) => (
            <button
              key={room.id}
              onClick={() => onRoomChange(room.id)}
              className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
                currentRoomId === room.id 
                  ? 'border-cyan-500/50 bg-cyan-500/10' 
                  : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              {/* Preview Gradient Background */}
              <div 
                className="h-20 w-full opacity-30 group-hover:opacity-50 transition-opacity"
                style={{
                  background: `linear-gradient(135deg, ${room.colors.accent}, ${room.colors.wall})`
                }}
              />
              
              <div className="p-3 text-left">
                <h3 className={`text-sm font-bold ${currentRoomId === room.id ? 'text-cyan-400' : 'text-white/80'}`}>
                  {room.name}
                </h3>
                <p className="text-[10px] text-white/40 mt-1 line-clamp-1 italic">
                  {room.persona}
                </p>
                
                {currentRoomId === room.id && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                    <span className="text-[10px] text-cyan-400 font-bold uppercase">Active Session</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="mt-auto p-2 border-t border-white/5 pt-4">
          <p className="text-[9px] text-white/20 text-center uppercase tracking-tighter">
            Neural Interface v4.2.0
          </p>
        </div>
      </div>
      
      {/* Toggle Handle */}
      <button 
        onClick={onToggle}
        className="self-center bg-[#0a0a0f]/90 backdrop-blur-xl border border-l-0 border-white/10 py-8 px-1 rounded-r-xl text-white/40 hover:text-cyan-400 transition-colors"
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </div>
  );
}
