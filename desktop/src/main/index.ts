import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { app, BrowserWindow, dialog, shell } from 'electron'
import type { FastifyInstance } from 'fastify'
import { abrirBaseDeDatos, type BaseDeDatos } from '../server/db/connection'
import { crearApp } from '../server/app'
import { iniciarBot, type Bot } from '../server/telegram/bot'
import { registroEnArchivo } from '../server/registro'
import { cargarEnv, rutasDeLaApp } from './env'
import { API_HOST, API_PORT } from '../shared/config'

let ventana: BrowserWindow | null = null
let servidor: FastifyInstance | null = null
let bot: Bot | null = null

// Una sola instancia: no puede haber dos APIs sobre la misma base de datos.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore()
      ventana.focus()
    }
  })
  app.whenReady().then(iniciar)
}

/** Carpeta de datos y .env: instalada → userData (%APPDATA%, «La Playa de las Mascotas»); desarrollo → repositorio. */
function rutas() {
  return rutasDeLaApp({ empaquetada: app.isPackaged, userData: app.getPath('userData'), appPath: app.getAppPath() })
}

function rutaBaseDeDatos(): string {
  const { carpetaDatos } = rutas()
  mkdirSync(carpetaDatos, { recursive: true })
  return join(carpetaDatos, 'playa.db')
}

/**
 * Chat operativo de Telegram (HU-10). Lee el .env (ver rutasDeLaApp) y deja sus avisos en
 * telegram.log, junto a playa.db. Si falta el .env o el token, o el bot falla al iniciar,
 * la app sigue funcionando sin chat.
 */
function iniciarChat(db: BaseDeDatos): void {
  const { carpetaDatos, env } = rutas()
  const registro = registroEnArchivo(join(carpetaDatos, 'telegram.log'))
  try {
    const existe = cargarEnv(env)
    registro.info(`Configuración del chat: ${env}${existe ? '' : ' (no existe; se usa el entorno del sistema)'}`)
    bot = iniciarBot(db, process.env, registro)
  } catch (e) {
    registro.error('No se pudo iniciar el chat de Telegram', e)
  }
}

async function iniciar(): Promise<void> {
  let db: BaseDeDatos
  try {
    db = abrirBaseDeDatos(rutaBaseDeDatos())
    const origenesPermitidos = ['null']
    if (process.env.ELECTRON_RENDERER_URL) {
      origenesPermitidos.push(new URL(process.env.ELECTRON_RENDERER_URL).origin)
    }
    servidor = crearApp(db, { origenesPermitidos })
    await servidor.listen({ host: API_HOST, port: API_PORT })
  } catch (e) {
    dialog.showErrorBox('La Playa de las Mascotas', `No se pudo iniciar la aplicación.\n\n${String(e)}`)
    app.quit()
    return
  }
  iniciarChat(db)
  crearVentana()
}

function crearVentana(): void {
  ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'La Playa de las Mascotas',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  ventana.on('ready-to-show', () => ventana?.show())
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    ventana.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    ventana.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('window-all-closed', async () => {
  bot?.detener()
  await servidor?.close()
  app.quit()
})
