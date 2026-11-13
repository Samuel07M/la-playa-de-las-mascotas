import { contextBridge } from 'electron'

// Expone a la ventana la URL de la API embebida.
contextBridge.exposeInMainWorld('playa', { apiUrl: 'http://127.0.0.1:3210' })
