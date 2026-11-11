// Builds SlimeSlayers-offline.html (the game) and SlimeSlayers-CharacterLab.html: single files with every script and font inside.
// They work on their own (double-click, email, USB stick). Offline = guest mode only (accounts, trading and boards need the server).
// Run: node tools/build-offline.js
const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
function build(page, outName) {
  let html = fs.readFileSync(path.join(pub, page), 'utf8');
  html = html.replace(/<script src="([\w.]+)"><\/script>/g, (m, f) => {
    const js = fs.readFileSync(path.join(pub, f), 'utf8').replace(/<\/script/gi, '<\\/script');
    return '<script>/* ' + f + ' */\n' + js + '\n</script>';
  });
  html = html.replace(/url\(fonts\/([\w.-]+)\)/g, (m, f) => 'url(data:font/woff;base64,' + fs.readFileSync(path.join(pub, 'fonts', f)).toString('base64') + ')');
  const out = path.join(__dirname, '..', outName);
  fs.writeFileSync(out, html);
  console.log('Wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}
build('index.html', 'SlimeSlayers-offline.html');
build('lab.html', 'SlimeSlayers-CharacterLab.html');
