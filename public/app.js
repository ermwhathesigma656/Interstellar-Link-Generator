const form = document.querySelector('#create-form'), nameInput = document.querySelector('#name');
const button = document.querySelector('#create'), status = document.querySelector('#status');
let subdomain = 'gonicvrnew';
function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }
function preview() { document.querySelector('#preview').textContent = `${nameInput.value.trim().toLowerCase() || 'my-schoolwork'}.${subdomain}.workers.dev`; }
nameInput.addEventListener('input', preview);
fetch('/api/config').then(r => r.json()).then(config => {
  subdomain = config.subdomain; preview(); button.disabled = !config.ready;
  message(config.ready ? 'Choose an available name to get started.' : 'The owner is connecting Cloudflare. Link creation will open shortly.');
}).catch(() => message('Could not connect. Refresh this page to try again.', true));
form.addEventListener('submit', async event => {
  event.preventDefault(); button.disabled = true; document.querySelector('#result').hidden = true;
  message('Creating your address… This may take a few seconds.');
  try {
    const response = await fetch('/api/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nameInput.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not create this link. Try again.');
    const link = document.querySelector('#link'); link.href = result.url; link.textContent = result.url;
    document.querySelector('#open').href = result.url; document.querySelector('#result').hidden = false;
    document.querySelector('#copy').textContent = 'Copy link';
    message(result.existing ? 'That link is already ready to use.' : 'Your Interstellar link has been created.');
  } catch (error) { message(error.message, true); }
  finally { button.disabled = false; }
});
document.querySelector('#copy').addEventListener('click', async event => {
  try { await navigator.clipboard.writeText(document.querySelector('#link').href); event.target.textContent = 'Copied!'; }
  catch { message('Select the link above to copy it.', true); }
});
