"""Isolated real templates and routes, with fake streams. Never imports app startup."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from presentation_fixture import create_runtime
from flask import render_template

app, mqtt = create_runtime()
STUB = '''<script>
window.auditStreams=[];window.auditAudios=[];window.auditRequests=[];
const NativeAudio=window.Audio;
window.Audio=class extends NativeAudio {constructor(...args){super(...args);auditAudios.push(this);}};
window.EventSource=class {constructor(url){this.url=url;auditStreams.push(this);}close(){}};
window.auditPush=data=>auditStreams.forEach(s=>s.onmessage?.({data:JSON.stringify(data)}));
const realFetch=window.fetch.bind(window);
window.fetch=(url,options={})=>{if(options.method==='POST'||String(url).includes('current_state')){auditRequests.push({url,method:options.method});return Promise.resolve(new Response('{}',{headers:{'Content-Type':'application/json'}}));}return realFetch(url,options);};
</script>'''

@app.after_request
def stub_game_io(response):
    if response.mimetype == 'text/html':
        # Static rehearsal HTML uses send_file's streaming response too.
        response.direct_passthrough = False
        response.set_data(response.get_data(as_text=True).replace('<head>', '<head>'+STUB, 1))
    return response

@app.route('/audit/puzzle/<int:puzzle_id>')
def extra_puzzle(puzzle_id):
    if puzzle_id not in (7,9,10):
        return '',404
    return render_template(f'puzzle{puzzle_id}.html',puzzle_id=puzzle_id,next_puzzle_id=None,current_level=1,final_puzzle_id=6)

if __name__=='__main__':
    app.run(host='127.0.0.1',port=8766,debug=False)
