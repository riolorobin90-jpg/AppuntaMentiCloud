const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

c = c.replace(/color-mix\(in srgb, var\(--primary\) (\d+)%, transparent\)/g, (m, p) => 'rgba(var(--primary-rgb), .' + (p.length === 1 ? '0' + p : p) + ')');

c = c.replace(/border-([^:]+):1px solid rgba\([^;]+\);border-[^:]+:1px solid color-mix[^;]+/g, 'border- solid var(--border)');
c = c.replace(/border:1px solid rgba\([^;]+\);border:1px solid color-mix[^;]+/g, 'border:1px solid var(--border)');

c = c.replace(/color-mix\(in srgb, var\(--border\) (\d+)%, transparent\)/g, 'var(--border)');
c = c.replace(/color-mix\(in srgb, var\(--border2\) (\d+)%, transparent\)/g, 'var(--border2)');

c = c.replace(/background:rgba\([^;]+\);background:color-mix\(in srgb, var\(--surface(\d*)\) (\d+)%, transparent\)/g, 'background:var(--surface)');
c = c.replace(/background:color-mix\(in srgb, var\(--surface(\d*)\) (\d+)%, transparent\)/g, 'background:var(--surface)');

// The previous step might have missed some border ones if they were separated by space or didn't have parentheses correctly grouped.
// Let's do a more robust sweep:
c = c.replace(/border(-[a-z]+)?:1px solid rgba\([^\)]+\);border-[a-z]*:?1px solid color-mix\([^\)]+\)/g, 'border solid var(--border)');

// Let's also remove any leftover color-mix
c = c.replace(/color-mix\([^\)]+\)/g, 'transparent'); // fallback for anything missed

fs.writeFileSync('index.html', c);
console.log('Fixed CSS color-mix uses!');
