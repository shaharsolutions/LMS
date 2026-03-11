import { initRouter } from './src/router.js'
import { checkAuth, onAuthStatusChange } from './src/auth.js'

document.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app')
  
  // App initialization flow
  try {
    const user = await checkAuth()
    
    // Set global data and init router
    window.__APP_STATE = { user }
    
    // Listen for session invalidations
    onAuthStatusChange();

    initRouter(appContainer)
    
  } catch (err) {
    console.error("Initialization Failed", err)
    appContainer.innerHTML = `<div class="container mt-4 text-center"><h2>שגיאה בטעינת המערכת</h2><p>${err.message}</p></div>`
  }
})
