import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { app, BrowserWindow, dialog, shell } from 'electron'
import type { FastifyInstance } from 'fastify'
import { abrirBaseDeDatos } from '../server/db/connection'
import { crearApp } from '../server/app'
import { API_HOST, API_PORT } from '../shared/config'

let ventana: BrowserWindow | null = null
let servidor: FastifyInstance | null = null

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

function rutaBaseDeDatos(): string {
  // En desarrollo: desktop/dev-data/playa.db. Instalada: carpeta de datos de la app en Windows.
  const carpeta = app.isPackaged ? app.getPath('userData') : join(app.getAppPath(), 'dev-data')
  mkdirSync(carpeta, { recursive: true })
  return join(carpeta, 'playa.db')
}

async function iniciar(): Promise<void> {
  try {
    const db = abrirBaseDeDatos(rutaBaseDeDatos())
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
  await servidor?.close()
  app.quit()
})
