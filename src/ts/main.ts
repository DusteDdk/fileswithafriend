import Express from 'express';
import WebSocketServer from 'ws';
import QRCode from 'qrcode';
import { randomUUID } from 'crypto';

const app = Express();

const frontendUrl= process.env['FRONTEND_URL'];

if(!frontendUrl) {
    console.error('Environment variable FRONTEND_URL must be set.');
    process.exit(1);
}

app.use( (req, res, next)=>{
    console.log(`${new Date()} - ${req.method} ${req.url} - ${req.headers['x-forwarded-for']}`);
    next();
});

app.use( '/send', Express.static('/src/client/'));

app.get('/send/sessions/:sessionId', (req,res)=>{
    if(!sessions[req.params.sessionId]) {
        return res.status(404).send('Session not found.');
    }
    res.cookie('session', req.params.sessionId);
    res.redirect(301, '/send');
});


const server=  app.listen(3000, ()=>console.log('Listening'));
const ss = new WebSocketServer.Server({server});

const sessions: any = {};

const stats = {
    booted: new Date(),
    connections:0,
    sessions: 0,
    busy: 0,
    nosession:0,
    bytes: 0,
};

app.get('/send/stats', (req, res)=>{
    res.send(`<pre>${JSON.stringify(stats,null,4)}</pre>`);
});

ss.on('connection', async (client, req: any)=>{

    stats.connections++;

    let state = 0;
    let fn = '';
    let len = 0;


    
    let recv: any = [];

    let session: any = null;
    let role = 'null';

    client.on('message', async (data)=>{
        const d = JSON.parse(data.toString());

        if(d.type === 'host') {
            const id = randomUUID();
            session = { id, host: client, guest: null, lonePongs: 0 };
            sessions[id]=session;
            role='host';
        
            const url = `${frontendUrl}/send/sessions/${id}`;
            const qr = await QRCode.toDataURL(url, {
                errorCorrectionLevel: 'M',
                scale: 9
            });

            client.send(JSON.stringify({
                type: 'waiting',
                code: qr,
                id,
                url,
            }));
            client.send(JSON.stringify({type: 'pong'}));

            client.on('close', ()=>{
                if(session) {
                    delete sessions[id];

                }

            });
            return;
        }

        if(d.type === 'join') {
            session = sessions[d.id];


            if(!session) {
                stats.nosession++;
                client.send(JSON.stringify({
                    type: 'error',
                    message:`No open session ${d.id}`
                }));
                return;
            }

            if(session.guest) {
                stats.busy++;
                return;
            }
            stats.sessions++;

            
            role='guest';
            client.on('close', ()=>{
                session.host?.close();
            });

            session.guest = client;
            session.host.send(JSON.stringify({type: 'hosting'}));
            client.send(JSON.stringify({type: 'joined'}));
            return;
        }

        if(session) {
            const dataStr = JSON.stringify(d);
            stats.bytes += dataStr.length*2;
            if(role === 'host') {
                

                if(session.guest) {
                    session.guest.send(dataStr);
                } else if(d.type === 'ping') {
                    session.lonePongs++;
                    if(session.lonePongs < (3600/2/4)) {
                        session.host.send(JSON.stringify({type: 'pong'}));
                    }
                }
            }
            if(role === 'guest') {
                session.host.send(dataStr);
            }
        }

    });
});
