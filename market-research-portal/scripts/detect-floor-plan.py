#!/usr/bin/env python3
import cv2,json,subprocess,sys
from pathlib import Path

path=Path(sys.argv[1]); image=cv2.imread(str(path))
if image is None: raise SystemExit('Image could not be decoded')
h,w=image.shape[:2]
if w<100 or h<100 or w*h>40_000_000: raise SystemExit('Image dimensions are unsupported')
gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY);gray=cv2.GaussianBlur(gray,(3,3),0)
binary=cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,9)
kernel=cv2.getStructuringElement(cv2.MORPH_RECT,(3,3));clean=cv2.morphologyEx(binary,cv2.MORPH_CLOSE,kernel)
elements=[]
lines=cv2.HoughLinesP(clean,1,3.14159/180,threshold=max(35,min(w,h)//12),minLineLength=min(w,h)//8,maxLineGap=12)
if lines is not None:
 for x1,y1,x2,y2 in lines[:,0][:160]:
  length=((x2-x1)**2+(y2-y1)**2)**.5
  angle=abs(__import__('math').degrees(__import__('math').atan2(y2-y1,x2-x1)))%180
  if min(angle,abs(90-angle),abs(180-angle))>12: continue
  elements.append({'type':'internal_wall','label':None,'geometry':{'kind':'line','x1':x1/w,'y1':y1/h,'x2':x2/w,'y2':y2/h},'confidence':round(min(.88,.48+length/max(w,h)*.4),3),'metadata':{'pixels':round(length,1)}})
contours,_=cv2.findContours(clean,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
rooms=[]
for c in contours:
 x,y,rw,rh=cv2.boundingRect(c);area=rw*rh/(w*h)
 if .025<=area<=.70 and rw>50 and rh>50:
  ratio=cv2.contourArea(c)/(rw*rh)
  if ratio>.12: rooms.append((area,x,y,rw,rh,ratio))
rooms.sort(reverse=True);kept=[]
for area,x,y,rw,rh,ratio in rooms:
 if any(abs(x-a[0])<8 and abs(y-a[1])<8 and abs(rw-a[2])<8 and abs(rh-a[3])<8 for a in kept):continue
 kept.append((x,y,rw,rh));elements.append({'type':'room','label':None,'geometry':{'kind':'rectangle','x':x/w,'y':y/h,'width':rw/w,'height':rh/h},'confidence':round(min(.82,.42+ratio*.35),3),'metadata':{'areaRatio':round(area,4)}})
try:
 tsv=subprocess.run(['tesseract',str(path),'stdout','--psm','11','tsv'],capture_output=True,text=True,timeout=45,check=True).stdout.splitlines()[1:]
 for row in tsv:
  cols=row.split('\t');
  if len(cols)<12:continue
  text=cols[11].strip();conf=float(cols[10]) if cols[10] not in ('','-1') else -1
  if text and conf>=25:
   x,y,rw,rh=map(int,cols[6:10]);elements.append({'type':'text','label':text,'geometry':{'kind':'rectangle','x':x/w,'y':y/h,'width':rw/w,'height':rh/h},'confidence':round(conf/100,3),'metadata':{}})
except Exception as e: ocr_error=str(e)
labels=[e for e in elements if e['type']=='text']
for room in [e for e in elements if e['type']=='room']:
 g=room['geometry'];cx=g['x']+g['width']/2;cy=g['y']+g['height']/2
 nearby=sorted(labels,key=lambda t:(t['geometry']['x']-cx)**2+(t['geometry']['y']-cy)**2)
 if nearby and abs(nearby[0]['geometry']['x']-cx)<g['width'] and abs(nearby[0]['geometry']['y']-cy)<g['height']:room['label']=nearby[0]['label'];room['confidence']=round(min(room['confidence'],nearby[0]['confidence']),3)
room_conf=[e['confidence'] for e in elements if e['type']=='room'];confidence=round(sum(room_conf)/len(room_conf),3) if room_conf else 0
print(json.dumps({'image':{'width':w,'height':h},'elements':elements,'summary':{'walls':sum(e['type'].endswith('wall') for e in elements),'rooms':len(room_conf),'textLabels':len(labels)},'confidence':confidence,'limitations':['Doors, windows and structural semantics require human review.','Scale is unknown until property dimensions are supplied.']}))
