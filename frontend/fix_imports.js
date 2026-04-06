const fs = require('fs');
const file = 'c:/Printis/frontend/app/profile/messages/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(
    /Truck, PackageCheck, CheckCircle2, AlertTriangle, ShieldAlert, Info, Mail, ExternalLink/,
    'Truck, PackageCheck, CheckCircle2, AlertTriangle, ShieldAlert, Info, Mail, ExternalLink, Ruler, Palette, CreditCard'
);

fs.writeFileSync(file, txt);
console.log('done fixing imports');
