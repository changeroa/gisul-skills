#!/usr/bin/env python3
"""Build the document reader from authored evidence and already-rendered UML SVGs.

Python standard library only. Does not crawl, review code, render UML, or deploy.
"""
import argparse
import collections
import hashlib
import html
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

TYPES={'sequence','activity','state','object','component','deployment','class'}
STATUSES={'CONFIRMED','NEEDS_CONTEXT','REJECTED'}

def require(condition,message):
    if not condition:
        raise ValueError(message)

def text(value,label):
    require(isinstance(value,str) and bool(value.strip()),f'{label}: nonempty text required')
    return value

def texts(value,label):
    require(isinstance(value,list) and bool(value),f'{label}: nonempty list required')
    for i,item in enumerate(value):text(item,f'{label}[{i}]')

def svg_check(svg,label):
    text(svg,label)
    require('<!DOCTYPE' not in svg and '<!ENTITY' not in svg,f'{label}: external XML declarations forbidden')
    root=ET.fromstring(svg)
    require(root.tag.split('}')[-1]=='svg',f'{label}: SVG root required')
    require('viewBox' in root.attrib,f'{label}: responsive viewBox required')
    for el in root.iter():
        tag=el.tag.split('}')[-1]
        require(tag not in {'script','foreignObject','iframe','image'},f'{label}: embedded executable/external content forbidden')
        for k,v in el.attrib.items():
            key=k.split('}')[-1].lower()
            require(not key.startswith('on'),f'{label}: event attributes forbidden')
            require(key!='href' or v.startswith('#'),f'{label}: only local fragment references allowed')
            require(not re.search(r'javascript:|https?://|data:',v,re.I),f'{label}: external or executable attribute forbidden')
        if tag=='style':require(not re.search(r'@import|url\(\s*["\']?(?!#)',el.text or '',re.I),f'{label}: external styles forbidden')

def normalize(payload,source_root=None):
    require(isinstance(payload,dict),'Input must have metadata and findings')
    meta=payload.get('metadata',{})
    for key in ['project','reviewRevision','reviewDate','scope']:
        text(meta.get(key),f'metadata.{key}')
    findings=payload.get('findings')
    require(isinstance(findings,list) and findings,'findings must be a nonempty list')
    counts=collections.Counter();ids=set();source_checks=0
    for d in findings:
        identifier=text(d.get('id'),'finding.id')
        require(bool(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*',identifier)),'ID must be safe in hashes and SVG IDs')
        require(identifier not in ids,f'Duplicate ID: {identifier}');ids.add(identifier)
        require(d.get('status') in STATUSES,f'{identifier}: unknown status')
        require(d.get('diagramType') in TYPES,f'{identifier}: unknown UML type')
        counts[d['status']]+=1
        for key in ['title','group','change','diagramLabel','diagramLegend','diagramQuestion','diagramReason','proposalNames','suggested_test']:
            text(d.get(key),f'{identifier}.{key}')
        d.setdefault('summary',d['title']);d.setdefault('severity','');d.setdefault('human_check','')
        if d['status']=='CONFIRMED':text(d['severity'],f'{identifier}.severity')
        if d['status']=='NEEDS_CONTEXT':text(d['human_check'],f'{identifier}.human_check')
        texts(d.get('trigger'),f'{identifier}.trigger')
        r=d.get('reader',{})
        for key in ['scene','normal','key','focus']:text(r.get(key),f'{identifier}.reader.{key}')
        for side in ['before','after']:texts(r.get(side),f'{identifier}.reader.{side}')
        require(isinstance(r.get('roles'),list) and r['roles'],f'{identifier}: reader roles required')
        for role in r['roles']:
            for k in ['name','where','role']:text(role.get(k),f'{identifier}.role.{k}')
        require(isinstance(d.get('codeTerms'),list) and d['codeTerms'],f'{identifier}: code name bridge required')
        for term in d['codeTerms']:
            for k in ['name','meaning']:text(term.get(k),f'{identifier}.term.{k}')
            s=term.get('source',{})
            for k in ['path','url']:text(s.get(k),f'{identifier}.term.source.{k}')
            require(s['url'].startswith('https://'),f'{identifier}: source URL must use https')
            require(isinstance(s.get('line'),int) and s['line']>0,f'{identifier}: positive source line required')
            if source_root:
                file=(source_root/s['path']).resolve()
                require(file.is_relative_to(source_root),f'{identifier}: source path escapes root')
                lines=file.read_text().splitlines()
                require(s['line']<=len(lines),f'{identifier}: source line outside file')
                match=term.get('match',term['name'])
                require(match in lines[s['line']-1],f'{identifier}: {term["name"]} does not match its pinned source line')
                source_checks+=1
        d.setdefault('contexts',[])
        for c in d['contexts']:
            for k in ['name','where','data','update','why']:text(c.get(k),f'{identifier}.context.{k}')
            c.setdefault('refs',[])
        verification=d.get('verification',{})
        text(verification.get('observed'),f'{identifier}.verification.observed')
        verification.setdefault('label','소스 근거 참조 · 실행 검증 범위는 판정 근거 확인')
        text(d.get('source'),f'{identifier}.source')
        require(d['source'].startswith('https://'),f'{identifier}: source URL must use https')
        location=d.get('primary_location',{})
        text(location.get('path'),f'{identifier}.primary_location.path')
        require(isinstance(location.get('start_line'),int) and location['start_line']>0,f'{identifier}: primary source line required')
        for side in ['before','after']:
            svg_check(d.get(side+'Svg'),f'{identifier}.{side}Svg')
            texts(d.get(side+'Reading'),f'{identifier}.{side}Reading')
            text(d.get(side+'Outcome'),f'{identifier}.{side}Outcome')
            spec=d.get(side+'Spec',{})
            require(spec.get('type')==d['diagramType'],f'{identifier}: exported definition type mismatch')
            require(spec.get('side')==side and spec.get('id')==identifier,f'{identifier}: exported definition identity mismatch')
            require(spec.get('sourceRevision')==meta['reviewRevision'],f'{identifier}: exported definition source revision mismatch')
            if d['diagramType']=='sequence':
                require(isinstance(spec.get('participants'),list) and len(spec['participants'])>=2,f'{identifier}: sequence participants required')
                require(isinstance(spec.get('messages'),list) and spec['messages'],f'{identifier}: sequence messages required')
                for message in spec['messages']:
                    require(len(message)==4 and all(isinstance(i,int) and 0<=i<len(spec['participants']) for i in message[:2]),f'{identifier}: invalid message endpoints')
                d[side]=spec['messages'];d['participants']=spec['participants']
            else:
                require(isinstance(spec.get('nodes'),list) and spec['nodes'],f'{identifier}: graph nodes required')
                node_ids={n['id'] for n in spec['nodes']}
                require(len(node_ids)==len(spec['nodes']),f'{identifier}: duplicate graph node')
                for n in spec['nodes']:n.setdefault('fields',[])
                for edge in spec.get('edges',[]):require(edge['a'] in node_ids and edge['b'] in node_ids,f'{identifier}: invalid edge endpoint')
                d[side+'Graph']={'nodes':spec['nodes'],'edges':spec.get('edges',[])}
    return meta,findings,counts,source_checks

def build(input_file,output,template,source_root=None):
    payload=json.loads(input_file.read_text())
    meta,findings,counts,source_checks=normalize(payload,source_root)
    replacements={
        '__PROJECT__':meta['project'],'__REVISION__':meta['reviewRevision'][:7],'__DATE__':meta['reviewDate'],
        '__INTRO__':meta.get('intro',f'리뷰 항목 {len(findings)}건의 원인과 전후 변화'),
        '__SCOPE__':meta['scope'],'__SYSTEM_HINT__':meta.get('systemHint','각 대상이 어디에 존재하고 무엇을 하는지 먼저 확인하세요.'),
        '__GLOSSARY__':meta.get('glossary','캐시·원본·지역 복사본의 구분은 각 항목의 저장 위치 설명을 참고하세요. SHA는 특정 소스 버전의 식별자입니다.'),
        '__FOOTNOTE__':meta.get('footnote','이전은 리뷰 기준 소스에서 추적한 동작입니다. 개선 후는 설계 제안이며 구현·배포 사실과 구분합니다. 미확정 후보에는 추가 확인이 필요합니다.'),
        '__ALL__':len(findings),**{f'__{status}__':counts[status] for status in STATUSES}
    }
    result=template.read_text()
    for token,value in replacements.items():result=result.replace(token,html.escape(str(value),quote=True))
    for token,value in [('/*__META__*/',meta),('/*__DATA__*/',findings)]:
        result=result.replace(token,json.dumps(value,ensure_ascii=False).replace('</','<\\/'))
    require(not re.search(r'__(?:PROJECT|DATA|META|REVISION|DATE|INTRO|SCOPE|ALL|CONFIRMED|NEEDS_CONTEXT|REJECTED|SYSTEM_HINT|GLOSSARY|FOOTNOTE)__',result),'Unresolved template placeholders')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(result)
    receipt={'artifact':str(output),'sha256':hashlib.sha256(result.encode()).hexdigest(),'source_revision':meta['reviewRevision'],'findings':len(findings),'diagrams':len(findings)*2,'counts':dict(counts),'source_line_checks':source_checks,'validation':'input structure, SVG XML, export type and graph endpoints','not_verified':['semantic code relationships','browser rendering and interactions','reader comprehension']}
    output.with_suffix('.receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(receipt,ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input',type=Path);parser.add_argument('output',type=Path)
    parser.add_argument('--template',type=Path,default=Path(__file__).resolve().parent.parent/'assets/explainer.html')
    parser.add_argument('--source-root',type=Path)
    args=parser.parse_args()
    try:build(args.input,args.output,args.template,args.source_root.resolve() if args.source_root else None)
    except (ValueError,KeyError,TypeError,OSError,ET.ParseError) as error:parser.exit(1,f'Build failed: {error}\n')
