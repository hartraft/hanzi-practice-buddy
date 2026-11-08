import { readFileSync, writeFileSync } from 'node:fs';
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:scheme="hartraft-shopping"')) {
  const activityClose = manifest.indexOf('</activity>');
  if (activityClose < 0) throw new Error('Could not find Capacitor MainActivity in AndroidManifest.xml');
  const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="hartraft-shopping" android:host="auth" android:path="/callback" />
            </intent-filter>
        `;
  manifest = manifest.slice(0, activityClose) + filter + manifest.slice(activityClose);
  writeFileSync(manifestPath, manifest);
}
const wrapperPath = 'android/gradle/wrapper/gradle-wrapper.properties';
let wrapper = readFileSync(wrapperPath, 'utf8');
if (!/^networkTimeout=/m.test(wrapper)) {
  wrapper = wrapper.trimEnd() + '\nnetworkTimeout=180000\n';
  writeFileSync(wrapperPath, wrapper);
}
console.log('Configured OAuth deep link and resilient Gradle download timeout.');
