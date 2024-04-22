

const id = document?.cookie?.split(';')[0]?.split('=')[1];

function deleteAllCookies() {
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
}
deleteAllCookies();

window.addEventListener("load", ()=>{

    const fisk = document.getElementById('fisk') as any;
    const pingPong = document.getElementById('pingpong') as any;
    const dialog = document.getElementById('dialog') as any;
    
    const proto = (window.location.protocol === 'https:')?'wss':'ws';
    const host = (window.location.hostname);
    const path = window.location.pathname;

    const wsUrl = `${proto}://${host}${path}socket`;
    const webSocket = new WebSocket(wsUrl);
    console.log('Connecting to ' +wsUrl);

    function showDiag() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple=false;
        fileInput.addEventListener('change', async ()=>{
            if(fileInput.files) {
                fileInput.style.display = 'none';
                const f = fileInput.files[0];
                
                const abuf = await f.arrayBuffer();
                const bytes = new Uint8Array(abuf);

                webSocket.send( JSON.stringify({
                    type: 'start',
                    name: f.name,
                    ftype: f.type,
                    len: bytes.length,
                }));

                let cs=0;
                let str = '';
                const lastByte = bytes.length - 1;
                for(let i = 0; i < bytes.length; i++) {
                    str += String.fromCharCode(bytes[i]);
                    cs++;

                    if(cs === 2048 || i === lastByte) {
                        webSocket.send(JSON.stringify({
                            type: 'data',
                            data: btoa(str)
                        }));
                        cs=0;
                        str='';
                    }
                    const pct = Math.floor(i/bytes.length*100);
                    fisk.innerHTML = `Sending ${f.name} (${pct}% - ${i} / ${bytes.length})`;

                }
                
                fisk.innerHTML = `Sent ${f.name}`;
                fileInput.style.display='block';

                
            }
        });
        dialog.append(fileInput);
    }

    webSocket.onopen = (e)=> {
        if(id) {
            webSocket.send(JSON.stringify({type:'join', id})); 
        } else {
            webSocket.send(JSON.stringify({type: 'host'}));
        }
    };
    let pingTime=new Date().getTime();

    let inbuf = new Uint8Array(0);
    let inname='';
    let intype='';
    let curByte=0;
    

    webSocket.onmessage = (e) => {
        const d = JSON.parse(e.data);


        if(d.type === 'start')
        {
            inbuf = new Uint8Array(d.len);
            inname = d.name;
            intype = d.ftype;
            curByte=0;
        }

        if(d.type === 'data') {
            const pct = Math.floor(curByte/inbuf.byteLength*100);
            fisk.innerHTML = `Receiving ${inname} (${pct}% - ${curByte} / ${inbuf.byteLength})`;

            const binStr = atob(d.data);
            for(let i = 0; i < binStr.length; i++) {
                inbuf[curByte] = binStr.charCodeAt(i);
                curByte++;
            }

            if(curByte === inbuf.byteLength) {
                fisk.innerHTML = `Received ${inname} (${pct}% - ${curByte} / ${inbuf.byteLength})`;

                const blob = new Blob([inbuf], {type: intype});
                const link = document.createElement('a');
                link.href=window.URL.createObjectURL(blob);
                link.download=inname;
                link.click();
            
            }
        }
    
        if(d.type === 'waiting') {
            fisk.innerHTML = `Send this link to a friend you wish to transfer files with (click to copy)<br><span id="link" onclick="copyText('${d.url}')">${d.url}</span><svg id="copybutton" onclick="copyText('${d.url}')" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg><br><img src="${d.code}">`;
        }
        
        if(d.type === 'hosting') {
            showDiag();
            fisk.innerHTML = `Your friend has connected`;
        }

        if(d.type === 'pong') {
            const latency = (new Date().getTime()) - pingTime;
            setTimeout( ()=> {
                pingTime = new Date().getTime();
                webSocket.send(JSON.stringify({
                    type:'ping',
                    latency
                }));
                pingPong.innerHTML = `Latency: ${latency} ms.`;
            },2000);
        }

        if(d.type === 'ping') {
            webSocket.send(JSON.stringify({type: 'pong'}));
            pingPong.innerHTML = `Latency: ${d.latency} ms.`;
        }
        
    
        if(d.type === 'joined') {
            showDiag();
            fisk.innerHTML = `Joined ${id}`;
        }
    
        if(d.type === 'error') {
            fisk.innerHTML = d.message;
            deleteAllCookies();
            webSocket.send(JSON.stringify({type: 'host'}));
        }



    };
    
    webSocket.onclose = ()=>{
        dialog.innerHTML = '';
        fisk.innerHTML = `Disconnected<br><br><button onclick="window.location.href=window.location.href'">Reload</button>`;
    }



    const f = document.getElementById('file');
    if(f) {
        f.addEventListener('change', async (event: any) => {
            // I wonder why I left this here..
        });
    }

    
});