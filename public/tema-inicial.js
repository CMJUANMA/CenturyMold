// Aplica el tema antes de pintar para evitar el parpadeo claro/oscuro (misma lógica que ThemeContext).
// Es un archivo aparte (y no un <script> dentro de index.html) para que la política de seguridad de contenido no necesite 'unsafe-inline'.
try {
  var g = localStorage.getItem('cm_theme');
  var osc = g === 'dark' || (g !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', osc);
  document.documentElement.style.colorScheme = osc ? 'dark' : 'light';
} catch (e) {}
