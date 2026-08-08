const fs = require('fs');
const readline = require('readline');
const mineflayer = require('mineflayer');
const { SocksClient } = require('socks');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const ACC_FILE = 'registered_accs.json';
const SERVER_HOST = '185.207.166.54';
const SERVER_PORT = 19000;
const CONNECT_TIMEOUT = 25000;

function loadRegisteredAccs() {
  if (!fs.existsSync(ACC_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ACC_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function moveAccToBottom(accName) {
  let list = loadRegisteredAccs();
  if (list.length === 0) return;

  const targetAcc = list.find(a => a.name === accName);
  if (!targetAcc) return;

  list = list.filter(a => a.name !== accName);
  list.push(targetAcc);

  fs.writeFileSync(ACC_FILE, JSON.stringify(list, null, 4), 'utf8');
}

function parseProxy(proxyStr) {
  const u = new URL(proxyStr);
  return {
    ip: u.hostname,
    port: parseInt(u.port),
    type: u.protocol.includes('socks4') ? 4 : 5
  };
}

async function checkProxyIp(proxyUrl) {
  try {
    const agent = new SocksProxyAgent(proxyUrl);
    const res = await axios.get('https://api.ipify.org?format=json', {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 5000
    });
    return res.data.ip;
  } catch (err) {
    return null;
  }
}

async function runTpaBot(account, targetName) {
  return new Promise(async (resolve) => {
    console.log(`\n-----------------------------------------`);
    console.log(`[1] Kiem tra Proxy cho acc: ${account.name}...`);

    const realIp = await checkProxyIp(account.proxy);
    if (!realIp) {
      console.log(`[X] Proxy DIE/Timeout! Bo qua acc nay.`);
      return resolve(false);
    }
    console.log(`[✓] Proxy LIVE | IP: ${realIp}`);

    console.log(`[2] Dang ket noi vao server...`);
    console.log(`    Acc Name : ${account.name}`);

    const pInfo = parseProxy(account.proxy);
    let isDone = false;
    let isLoggedIn = false;
    let sequenceStarted = false;
    let bot = null;

    let connectTimer = setTimeout(() => {
      if (!isDone) {
        console.log(`[!] Timeout ket noi (25s) -> Bo qua acc nay.`);
        cleanUp(false);
      }
    }, CONNECT_TIMEOUT);

    function cleanUp(successStatus) {
      if (isDone) return;
      isDone = true;
      if (connectTimer) clearTimeout(connectTimer);

      if (bot) {
        try {
          bot.removeAllListeners();
          if (bot._client) bot._client.removeAllListeners();
          bot.end();
        } catch (e) {}
      }
      resolve(successStatus);
    }

    const customConnect = (client) => {
      client.on('error', (err) => {
        if (!isDone) {
          console.log(`[X] Socket Error: ${err.message}`);
          cleanUp(false);
        }
      });

      SocksClient.createConnection({
        proxy: {
          host: pInfo.ip,
          port: pInfo.port,
          type: pInfo.type
        },
        command: 'connect',
        destination: {
          host: SERVER_HOST,
          port: SERVER_PORT
        },
        timeout: 10000
      }).then(info => {
        client.setSocket(info.socket);
        client.emit('connect');
      }).catch(err => {
        console.log(`[X] Loi SOCKS Socket: ${err.message}`);
        cleanUp(false);
      });
    };

    bot = mineflayer.createBot({
      host: SERVER_HOST,
      port: SERVER_PORT,
      username: account.name,
      connect: customConnect,
      version: false
    });

    bot.on('error', (err) => {
      if (!isDone) {
        console.log(`[X] Bot Error: ${err.message}`);
        cleanUp(false);
      }
    });

    bot.on('messagestr', async (msg) => {
      const cleanMsg = msg.trim();
      if (cleanMsg) {
        console.log(`[SERVER CHAT] ${cleanMsg}`);
      }

      // Đăng nhập khi phát hiện dòng thông báo yêu cầu login
      if (!isLoggedIn && (
        cleanMsg.includes('ᴠᴜɪ ʟòɴɢ đăɴɢ ɴʜậᴘ ʙằɴɢ ʟệɴʜ: /login') || 
        cleanMsg.includes('/login') || 
        cleanMsg.includes('đăɴɢ ɴʜậᴘ')
      )) {
        isLoggedIn = true;
        if (connectTimer) clearTimeout(connectTimer);
        console.log(`[+] Phat hien yeu cau login -> Gui lenh /login ${account.pass}...`);
        await new Promise(r => setTimeout(r, 1500));
        bot.chat(`/login ${account.pass}`);
      }

      // Tự động TPA lại nếu yêu cầu hết hạn
      if (cleanMsg.includes('ʏêᴜ ᴄầᴜ ᴅịᴄʜ ᴄʜᴜʏểɴ ᴄủᴀ ʙạɴ đã ʜếᴛ ʜạɴ!')) {
        console.log(`[!] TPA het han! Tu dong gui lai /tpa ${targetName}...`);
        await new Promise(r => setTimeout(r, 1500));
        bot.chat(`/tpa ${targetName}`);
      }
    });

    bot.on('spawn', async () => {
      if (connectTimer) clearTimeout(connectTimer);

      if (!sequenceStarted) {
        sequenceStarted = true;
        console.log(`[✓] Bot da load xong vao game!`);

        // Bước 1: /warp spawn
        await new Promise(r => setTimeout(r, 2000));
        console.log(`[>] Gui lenh: /warp spawn`);
        bot.chat('/warp spawn');

        // Bước 2: Chờ 5 giây tại spawn
        console.log(`[⏳] Dang cho 5 giay tai spawn...`);
        await new Promise(r => setTimeout(r, 5000));

        // Bước 3: Gửi /tpa
        console.log(`[>] Gui lenh: /tpa ${targetName}`);
        bot.chat(`/tpa ${targetName}`);
        console.log(`[☠] Dang cho den khi bot CHET de hoan thanh...`);
      }
    });

    bot.on('death', () => {
      console.log(`\n[☠☠☠] BOT DA CHET! HOAN THANH NHIEM VU.`);
      cleanUp(true);
    });

    bot.on('end', () => {
      if (!isDone) {
        console.log(`[-] Bot ngat ket noi truoc khi chet.`);
        cleanUp(false);
      }
    });
  });
}

async function main() {
  const accounts = loadRegisteredAccs();
  if (accounts.length === 0) {
    console.log(`[X] Khong tim thay tai khoan nao trong file ${ACC_FILE}!`);
    return;
  }

  console.log(`[i] Tim thay ${accounts.length} tai khoan trong ${ACC_FILE}.`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Nhap TEN player nhan TPA: ', (targetName) => {
    targetName = targetName.trim();
    if (!targetName) {
      console.log('Ten khong duoc de trong!');
      rl.close();
      return;
    }

    rl.question('Nhap SO LUONG nick CAN DEN BANG DU: ', async (countStr) => {
      const targetCount = parseInt(countStr.trim(), 10);
      rl.close();

      if (isNaN(targetCount) || targetCount <= 0) {
        console.log('So luong khong hop le!');
        return;
      }

      let successCount = 0;
      let totalTried = 0;

      while (successCount < targetCount && totalTried < accounts.length) {
        const currentList = loadRegisteredAccs();
        if (currentList.length === 0) break;

        const currentAcc = currentList[0];

        console.log(`\n=== PROGRESS: ${successCount}/${targetCount} THANH CONG ===`);
        console.log(`>>> Dang thu ACC: ${currentAcc.name}`);

        const isSuccess = await runTpaBot(currentAcc, targetName);

        moveAccToBottom(currentAcc.name);
        console.log(`[🔄] Da chuyen acc ${currentAcc.name} xuong cuoi danh sach JSON.`);

        totalTried++;

        if (isSuccess) {
          successCount++;
          console.log(`[✓] ACC HOAN THANH -> Tinh +1 vao chi tieu!`);
        } else {
          console.log(`[-] ACC LOI -> KHONG TINH vao chi tieu. Chuyen acc tiep theo...`);
        }

        await new Promise(r => setTimeout(r, 2000));
      }

      console.log(`\n=========================================`);
      if (successCount < targetCount) {
        console.log(`[!] DA DUYET HET DANH SACH: Chi dat ${successCount}/${targetCount} acc thanh cong.`);
      } else {
        console.log(`[✓] DA HOAN THANH DU ${successCount}/${targetCount} ACCS CHET CHO PLAYER!`);
      }
    });
  });
}

process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

main();
