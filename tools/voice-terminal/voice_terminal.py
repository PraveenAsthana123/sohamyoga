#!/usr/bin/env python3
"""Local microphone -> Whisper -> confirmed Codex/Claude prompt launcher."""
from __future__ import annotations
import argparse, hashlib, json, os, shutil, subprocess, sys, tempfile, time
from pathlib import Path

ROOT=Path(__file__).resolve().parent
LOG=Path.home()/'.local/state/voice-terminal/events.jsonl'

def audit(event:str,**fields:object)->None:
    LOG.parent.mkdir(parents=True,exist_ok=True)
    with LOG.open('a',encoding='utf-8') as f:f.write(json.dumps({'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'event':event,**fields})+'\n')

def record(path:Path,seconds:int|None)->None:
    recorder=shutil.which('arecord')
    if not recorder:raise RuntimeError('arecord is required (alsa-utils)')
    cmd=[recorder,'-q','-f','S16_LE','-r','16000','-c','1',str(path)]
    print('🎙  Listening…'+(f' {seconds}s' if seconds else ' press Enter to stop'))
    proc=subprocess.Popen(cmd)
    try:
        if seconds:proc.wait(timeout=seconds)
        else:input()
    except subprocess.TimeoutExpired:pass
    finally:
        if proc.poll() is None:proc.terminate();proc.wait(timeout=3)

def transcribe(path:Path,model_name:str,language:str|None)->str:
    try:from faster_whisper import WhisperModel
    except ImportError as e:raise RuntimeError('STT is not installed; run tools/voice-terminal/setup.sh') from e
    print(f'📝 Transcribing locally with faster-whisper {model_name}…')
    model=WhisperModel(model_name,device='cpu',compute_type='int8')
    segments,_=model.transcribe(str(path),language=language,vad_filter=True)
    return ' '.join(s.text.strip() for s in segments).strip()

def executable(agent:str)->str:
    if agent=='claude':
        found=shutil.which('claude')
        if found:return found
    else:
        found=shutil.which('codex')
        if found and not found.startswith('/snap/'):return found
        candidates=sorted(Path.home().glob('.vscode/extensions/openai.chatgpt-*/bin/linux-x86_64/codex'),reverse=True)
        if candidates:return str(candidates[0])
    raise RuntimeError(f'{agent} CLI is not installed')

def main()->int:
    p=argparse.ArgumentParser(description='Give a confirmed voice prompt to Codex or Claude Code')
    p.add_argument('--agent',choices=['codex','claude'],default='codex');p.add_argument('--audio',type=Path)
    p.add_argument('--text');p.add_argument('--seconds',type=int);p.add_argument('--model',default='tiny.en');p.add_argument('--language')
    p.add_argument('--cwd',type=Path,default=Path.cwd());p.add_argument('--yes',action='store_true',help='skip confirmation (not recommended)')
    p.add_argument('--dry-run',action='store_true');p.add_argument('--one-shot',action='store_true');p.add_argument('--speak-response',action='store_true')
    args=p.parse_args();audio:Path|None=args.audio
    try:
        if args.text:prompt=args.text.strip()
        else:
            if audio is None:
                tmp=tempfile.NamedTemporaryFile(prefix='voice-terminal-',suffix='.wav',delete=False);tmp.close();audio=Path(tmp.name)
                record(audio,args.seconds)
            prompt=transcribe(audio,args.model,args.language)
        if not prompt:raise RuntimeError('No speech was recognized')
        digest=hashlib.sha256(prompt.encode()).hexdigest()[:16]
        print(f'\nRecognized:\n  {prompt}\n')
        audit('transcribed',agent=args.agent,prompt_sha256=digest,characters=len(prompt))
        if args.dry_run:return 0
        if not args.yes and input(f'Send to {args.agent}? [y/N] ').strip().lower() not in {'y','yes'}:
            audit('cancelled',agent=args.agent,prompt_sha256=digest);print('Cancelled.');return 2
        exe=executable(args.agent);cmd=[exe]
        if args.one_shot:cmd+=['exec',prompt] if args.agent=='codex' else ['-p',prompt]
        else:cmd+=[prompt]
        audit('launched',agent=args.agent,prompt_sha256=digest,one_shot=args.one_shot,cwd=str(args.cwd))
        if args.one_shot and args.speak_response:
            result=subprocess.run(cmd,cwd=args.cwd,text=True,capture_output=True);print(result.stdout,end='')
            if result.stdout and shutil.which('espeak-ng'):subprocess.run(['espeak-ng',result.stdout[:4000]],check=False)
            return result.returncode
        return subprocess.call(cmd,cwd=args.cwd)
    except (RuntimeError,KeyboardInterrupt,subprocess.SubprocessError) as e:
        audit('failed',agent=args.agent,error=str(e));print(f'voice-terminal: {e}',file=sys.stderr);return 1
    finally:
        if audio and not args.audio:audio.unlink(missing_ok=True)
if __name__=='__main__':raise SystemExit(main())

