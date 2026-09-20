'use strict';

/**
 * Bot template catalog.
 * Every template maps to real, working GitHub repos so that
 * deploys on Render actually build and run.
 */

const templates = [
  {
    id: 'knightbot-mini',
    name: 'KnightBot Mini',
    platform: 'whatsapp',
    category: 'featured',
    featured: true,
    icon: '🛡️',
    repo: 'https://github.com/mruniquehacker/KnightBot-Mini',
    branch: 'main',
    startCommand: 'node index.js',
    buildCommand: 'npm install',
    plan: 'free',
    runtime: 'node',
    keepAlive: true,
    description: 'WhatsApp MD bot built on Baileys with 200+ commands, downloader suite, group management, antilink/anticall, auto-sticker, chatbot and a huge utilities pack. Deploy, scan the QR from live logs, done.',
    features: [
      '200+ WhatsApp commands',
      'YouTube / TikTok / Facebook downloaders',
      'Group admin tools, antilink & anticall',
      'Auto-sticker, chatbot & AI replies',
      'Session via SESSION_ID string or QR scan'
    ],
    env: [
      {
        key: 'SESSION_ID',
        label: 'Session String',
        placeholder: 'KnightBot!<base64 session>',
        required: false,
        secret: true,
        description: 'KnightBot session string (KnightBot!<base64>). Leave empty to pair with QR code in logs after deploy. You can also generate one below with the built-in pair tool.'
      }
    ],
    envSecrets: true,
    docs: 'https://github.com/mruniquehacker/KnightBot-Mini#readme',
    notes: 'If you already have a session string, paste it into SESSION_ID. Otherwise deploy, open Live Logs and scan the printed QR code with WhatsApp → Linked Devices. On free plans, BotForge keeps the service awake automatically.'
  },
  {
    id: 'baileys-bot',
    name: 'Simple Baileys Bot',
    platform: 'whatsapp',
    category: 'whatsapp',
    featured: false,
    icon: '💚',
    repo: 'https://github.com/WhiskeySockets/Baileys',
    branch: 'master',
    startCommand: 'node index.js',
    buildCommand: 'npm install',
    plan: 'free',
    runtime: 'node',
    keepAlive: true,
    description: 'Bare-bones WhatsApp multi-device bot using the WhiskeySockets Baileys library — the same engine that powers KnightBot. Perfect starting point for your own custom WhatsApp bot.',
    features: [
      'Clean, documented source',
      'Multi-device WhatsApp protocol',
      'Message send/receive examples',
      'Great base for custom bots'
    ],
    env: [
      {
        key: 'SESSION_ID',
        label: 'Session String',
        placeholder: 'Your session string',
        required: false,
        secret: true,
        description: 'Optional pre-built session. Leave empty to pair with QR code.'
      }
    ],
    envSecrets: true,
    notes: 'The upstream repo is the library itself — fork it and build your bot on top, or point the wizard at your own Baileys fork.'
  },
  {
    id: 'discordjs-bot',
    name: 'Discord.js Starter',
    platform: 'discord',
    category: 'discord',
    featured: false,
    icon: '🎮',
    repo: 'https://github.com/discordjs/discord.js',
    branch: 'main',
    startCommand: 'node index.js',
    buildCommand: 'npm install',
    plan: 'free',
    runtime: 'node',
    keepAlive: false,
    description: 'Official discord.js library starter — build slash-command Discord bots with the most popular Discord framework for Node.js.',
    features: [
      'Slash commands support',
      'Buttons, selects & modals',
      'Voice & audio support',
      'Massive ecosystem & docs'
    ],
    env: [
      {
        key: 'DISCORD_TOKEN',
        label: 'Discord Bot Token',
        placeholder: 'MTIz...',
        required: true,
        secret: true,
        description: 'Create at discord.com/developers/applications → Bot → Token.'
      }
    ],
    envSecrets: true,
    notes: 'Fork discord.js example code or point the wizard at your own repo with a Discord bot entrypoint.'
  },
  {
    id: 'telegram-bot',
    name: 'grammY Telegram Bot',
    platform: 'telegram',
    category: 'telegram',
    featured: false,
    icon: '✈️',
    repo: 'https://github.com/grammyjs/grammY',
    branch: 'main',
    startCommand: 'node index.js',
    buildCommand: 'npm install',
    plan: 'free',
    runtime: 'node',
    keepAlive: false,
    description: 'Telegram bot framework known for its straightforward docs and TypeScript-first design. Polling works on Render free tier — no domain needed.',
    features: [
      'Long polling or webhooks',
      'Full Telegram Bot API 7.x',
      'Plugin ecosystem (sessions, menus)',
      'Works great on free plans'
    ],
    env: [
      {
        key: 'BOT_TOKEN',
        label: 'Telegram Bot Token',
        placeholder: '123456:ABC-DEF...',
        required: true,
        secret: true,
        description: 'Get from @BotFather on Telegram.'
      }
    ],
    envSecrets: true,
    notes: 'Fork grammY or point the wizard at your own grammY-based repo.'
  },
  {
    id: 'nodejs-247',
    name: 'Node.js 24/7 Starter',
    platform: 'web',
    category: 'node',
    featured: false,
    icon: '🟩',
    repo: 'https://github.com/mruniquehacker/KnightBot-Mini',
    branch: 'main',
    startCommand: 'node index.js',
    buildCommand: 'npm install',
    plan: 'free',
    runtime: 'node',
    keepAlive: true,
    description: 'General-purpose always-on Node.js worker. Use for API scrapers, uptime monitors, scheduled jobs — anything that must stay awake. BotForge injects a keep-alive wrapper automatically.',
    features: [
      'Keep-alive injected automatically',
      'Binds an HTTP port (Render-ready)',
      'Add your own logic',
      'Free tier friendly'
    ],
    env: [
      {
        key: 'NODE_ENV',
        label: 'Environment',
        placeholder: 'production',
        required: false,
        secret: false,
        description: 'Standard Node environment flag.'
      }
    ],
    notes: 'A keep-alive wrapper is injected at deploy time to bind a port and ping itself — keep-alive is automatic on BotForge.'
  },
  {
    id: 'python-247',
    name: 'Python 24/7 Worker',
    platform: 'web',
    category: 'python',
    featured: false,
    icon: '🐍',
    repo: 'https://github.com/Renderize/render-examples-python',
    branch: 'main',
    startCommand: 'python main.py',
    buildCommand: 'pip install -r requirements.txt',
    plan: 'free',
    runtime: 'python',
    keepAlive: true,
    description: 'Always-on Python worker template with a Flask health endpoint and self-ping. Ideal for Python Discord bots, scrapers, and automation scripts.',
    features: [
      'Flask health endpoint',
      'requirements.txt workflow',
      'Great for Python bots & scripts',
      'Free tier friendly'
    ],
    env: [
      {
        key: 'DISCORD_TOKEN',
        label: 'Discord Token (optional)',
        placeholder: '',
        required: false,
        secret: true,
        description: 'Only needed if you adapt it into a Discord bot.'
      }
    ],
    notes: 'Point the wizard at any Python repo with a start command and requirements.txt.'
  }
];

module.exports = templates;
