#!/usr/bin/env python3
import argparse,json
from faster_whisper import WhisperModel
p=argparse.ArgumentParser();p.add_argument('audio');p.add_argument('--model',default='tiny.en');p.add_argument('--language');a=p.parse_args()
model=WhisperModel(a.model,device='cpu',compute_type='int8');segments,info=model.transcribe(a.audio,language=a.language,vad_filter=True)
text=' '.join(s.text.strip() for s in segments).strip();print(json.dumps({'text':text,'language':info.language,'probability':info.language_probability}))
