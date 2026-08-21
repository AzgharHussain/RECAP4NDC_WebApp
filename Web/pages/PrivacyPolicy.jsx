import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import "./PrivacyPolicy.css";

function PrivacyPolicy() {
  const { language } = useLanguage();
  const isGu = language === 'gu';

  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/login" className="legal-back-link">
          {isGu ? '← લોગિન પર પાછા જાઓ' : '← Back to Login'}
        </Link>

        {/* ====== PRIVACY POLICY ====== */}
        <h1 className="legal-title">
          {isGu ? 'ગોપનીયતા નીતિ' : 'PRIVACY POLICY'}
        </h1>
        <h2 className="legal-subtitle">
          {isGu ? 'FMPS (વન મોનિટરિંગ અને પેટ્રોલિંગ સિસ્ટમ)' : 'FMPS (Forest Monitoring and Patrolling System)'}
        </h2>
        <p className="legal-updated">
          {isGu ? 'છેલ્લે અપડેટ: 20 જુલાઈ 2026' : 'Last Updated: 20 July 2026'}
        </p>

        <p>{isGu
          ? 'FMPS (વન મોનિટરિંગ અને પેટ્રોલિંગ સિસ્ટમ) ગુજરાત વન વિભાગ માટે RECAP4NDC પ્રોજેક્ટ અંગે વિકસાવવામાં આવેલ છે, જે Deutsche Gesellschaft für Internationale Zusammenarbeit (GIZ) GmbH દ્વારા અમલમાં મૂકવામાં આવ્યો છે. આ એપ્લિકેશન સરકારી વન પેટ્રોલિંગ, મોનિટરિંગ, સંરક્ષણ અને અમલીકરણ પ્રવૃત્તિઓને ટેકો આપવા માટે ગુજરાત વન વિભાગ દ્વારા સંચાલિત અને જાળવવામાં આવે છે.'
          : 'The FMPS (Forest Monitoring and Patrolling System) is developed for the Gujarat Forest Department under the RECAP4NDC Project, implemented by Deutsche Gesellschaft für Internationale Zusammenarbeit (GIZ) GmbH. The application is managed and maintained by the Gujarat Forest Department to support official forest patrolling, monitoring, conservation, and enforcement activities.'}
        </p>
        <p>{isGu
          ? 'ગુજરાત વન વિભાગ તમામ અધિકૃત વપરાશકર્તાઓની ગોપનીયતા અને સુરક્ષા પ્રતિ પ્રતિબદ્ધ છે. આ ગોપનીયતા નીતિ સમજાવે છે કે FMPS ઉપયોગ કરતી વખતે માહિતી કેવી રીતે એકત્રિત, ઉપયોગ, સંગ્રહ, જાહેર અને સુરક્ષિત કરવામાં આવે છે.'
          : 'The Gujarat Forest Department is committed to protecting the privacy and security of all authorized users. This Privacy Policy explains how information is collected, used, stored, disclosed, and safeguarded when you access and use the FMPS (Forest Monitoring and Patrolling System).'}
        </p>
        <p>{isGu
          ? 'FMPS એક મોબાઇલ એપ્લિકેશન છે જે વન પેટ્રોલિંગ અને મોનિટરિંગ પ્રવૃત્તિઓને ટેકો આપવા માટે વિકસાવવામાં આવ્યું છે. આ એપ અધિકૃત વન કર્મચારીઓને પેટ્રોલિંગ પ્રવૃત્તિઓ નોંધવા, ડિજિટલ પેટ્રોલિંગ રેકોર્ડ જાળવવા, કૂપ સીમા અને પેટ્રોલિંગ રુટ જોવા, જિઓ-ટેગ ફોટો કેપ્ચર કરવા અને વન આવરણમાં ફેરફાર જોવા માટે સક્ષમ બનાવે છે.'
          : 'FMPS (The Forest Monitoring and Patrolling System) is a mobile application developed to support forest patrolling and monitoring activities. The application enables authorized forest personnel to record patrolling activities, maintain digital patrolling records, view coupe boundaries and patrolling routes, capture geo-tagged photographs, and monitor changes in forest cover.'}
        </p>

        <h3>1. {isGu ? 'વિકાસકની માહિતી' : 'Developer Information'}</h3>
        <p>
          {isGu ? 'સંસ્થા: ગુજરાત વન વિભાગ' : 'Organization: Gujarat Forest Department'}<br />
          {isGu ? 'પ્રોજેક્ટ: FMPS (વન મોનિટરિંગ અને પેટ્રોલિંગ સિસ્ટમ)' : 'Project:– FMPS (Forest Monitoring and Patrolling System)'}<br />
          Email: gujfdp@gmail.com
        </p>

        <h3>2. {isGu ? 'અમે કઈ માહિતી એકત્રિત કરીએ છીએ' : 'Information We Collect'}</h3>
        <p>{isGu ? 'એપ્લિકેશન ફક્ત સરકારી વન પેટ્રોલિંગ અને મોનિટરિંગ પ્રવૃત્તિઓ માટે જરૂરી માહિતી એકત્રિત કરે છે.' : 'The application collects only the information necessary to perform official forest patrolling and monitoring activities.'}</p>
        <p>{isGu ? 'ઉપયોગ કરાયેલી સુવિધાઓ અનુસાર, એપ નીચે મુજબની માહિતી એકત્રિત કરી શકે છે:' : 'Depending on the features used, the application may collect:'}</p>
        <ul>
          <li>{isGu ? 'GPS સ્થાન' : 'GPS location'}</li>
          <li>{isGu ? 'પૃષ્ઠભૂમિ સ્થાન (active patrol દરમિયાન જ)' : 'Background location (during active patrols only)'}</li>
          <li>{isGu ? 'પેટ્રોલ રુટ' : 'Patrol routes'}</li>
          <li>{isGu ? 'પેટ્રોલ પ્રવૃત્તિઓની તારીખ અને સમય' : 'Date and time of patrol activities'}</li>
          <li>{isGu ? 'ડિવાઇસ કેમેરા ઉપયોગ કરી કેપ્ચર કરવામાં આવેલા પેટ્રોલ ફોટો' : 'Patrol photographs captured using the device camera'}</li>
        </ul>
        <p>{isGu ? 'એપ્લિકેશન અસરકારી કાર્યકારી હેતુઓ માટે જરૂરી ન હોય તેવી માહિતી એકત્રિત કરતું નથી.' : 'The application does not collect information that is not required for official operational purposes.'}</p>

        <h3>3. {isGu ? 'ઉપયોગમાં લેવાયેલી પરવાનગીઓ' : 'Permissions Used'}</h3>

        <h4>{isGu ? 'કેમેરા' : 'Camera'}</h4>
        <p>{isGu ? 'ઉપયોગ:' : 'Used for:'}</p>
        <ul>
          <li>{isGu ? 'સરકારી ક્ષેત્ર પ્રવૃત્તિ દરમિયાન પેટ્રોલ ફોટો કેપ્ચર કરવા' : 'Capturing patrol photographs during official field activities'}</li>
        </ul>
        <p>{isGu ? 'તમારી પરવાનગી મળ્યા બાદ જ કેમેરા ઉપયોગ કરવામાં આવે છે.' : 'The camera is accessed only after your permission is granted.'}</p>

        <h4>{isGu ? 'સ્થાન (Foreground)' : 'Location (Foreground)'}</h4>
        <p>{isGu ? 'ઉપયોગ:' : 'Used for:'}</p>
        <ul>
          <li>{isGu ? 'પેટ્રોલ રુટ નોંધવા' : 'Recording patrol routes'}</li>
          <li>{isGu ? 'પેટ્રોલ સ્થાનો નક્કી કરવા' : 'Verifying patrol locations'}</li>
          <li>{isGu ? 'કૂપ બાઉન્ડરી નેવિગેશનને ટેકો આપવા' : 'Supporting Coupe Boundary Navigation'}</li>
        </ul>
        <p>{isGu ? 'એપ્લિકેશનની યોગ્ય કામગીરી માટે સ્થાન એક્સેસ જરૂરી છે.' : 'Location access is essential for the proper functioning of the application.'}</p>

        <h4>{isGu ? 'પૃષ્ઠભૂમિ સ્થાન' : 'Background Location'}</h4>
        <p>{isGu
          ? 'Active patrol દરમિયાન, એપ્લિકેશન પૃષ્ઠભૂમિમાં ચાલતી વખતે આપનું સ્થાન જાણવતી રહી શકે છે:'
          : 'During an active patrol, the application may continue to access your location while running in the background to:'}
        </p>
        <ul>
          <li>{isGu ? 'પેટ્રોલ રુટ સતત નોંધવા' : 'Continuously record patrol routes'}</li>
          <li>{isGu ? 'પેટ્રોલ સ્થાનો નક્કી કરવા' : 'Verify patrol locations'}</li>
          <li>{isGu ? 'કૂપ બાઉન્ડરી નેવિગેશનને ટેકો આપવા' : 'Support Coupe Boundary Navigation'}</li>
          <li>{isGu ? 'એપ્લિકેશન ઘટાડવામાં આવે અથવા સ્ક્રીન બંધ હય ત્યારે પેટ્રોલ ટ્રેકિંગ અનંતરિત રાખવા' : 'Ensure uninterrupted patrol tracking when the application is minimized or the device screen is turned off'}</li>
        </ul>
        <p>{isGu ? 'પૃષ્ઠભૂમિ સ્થાન ફક્ત સરકારી વન પેટ્રોલિંગ કામગીરી દરભાન ઉપયોગ કરવામાં આવે છે.' : 'Background location is used only during official forest patrolling activities.'}</p>

        <h4>{isGu ? 'સંગ્રહ / ફોટો' : 'Storage / Photos'}</h4>
        <p>{isGu ? 'ઉપયોગ:' : 'Used for:'}</p>
        <ul>
          <li>{isGu ? 'એપ્લિકેશન દ્વારા કેપ્ચર કરવામાં આવેલા પેટ્રોલ ફોટો અપલોડ કરવા' : 'Uploading patrol photographs captured through the application'}</li>
        </ul>

        <h3>4. {isGu ? 'અમે તમારી માહિતી કેવી રીતે ઉપયોગ કરીએ છીએ' : 'How We Use Your Information'}</h3>
        <p>{isGu ? 'એકત્રિત માહિતી ફક્ત સરકારી હેતુઓ માટે ઉપયોગ કરવામાં આવે છે:' : 'The collected information is used exclusively for official government purposes, including:'}</p>
        <ul>
          <li>{isGu ? 'વન પેટ્રોલ પ્રવૃત્તિઓ નોંધવા અને મોનિટર કરવા' : 'Recording and monitoring forest patrol activities'}</li>
          <li>{isGu ? 'પેટ્રોલ રુટ અને ક્ષેત્ર મુલાકાતો ટ્રેક કરવા' : 'Tracking patrol routes and field visits'}</li>
          <li>{isGu ? 'વન સંરક્ષણ અને મોનિટરિંગ કામગીરીને ટેકો આપવા' : 'Supporting forest protection and monitoring operations'}</li>
          <li>{isGu ? 'ક્ષેત્ર પ્રવૃત્તિ રેકોર્ડ નક્કી કરવા' : 'Verifying field activity records'}</li>
          <li>{isGu ? 'એપ્લિકેશનની કામગીરી અને વિશ્વસનીયતા સુધારવા' : 'Improving application performance and reliability'}</li>
          <li>{isGu ? 'એપ્લિકેશન સુરક્ષા જાળવવા' : 'Maintaining application security'}</li>
        </ul>
        <p>{isGu ? 'તમારી વ્યક્તિગત માહિતી કદીએ વેચવામાં આવતી નથી અથવા વાણિજ્યિક જાહેરાત માટે ઉપયોગ કરવામાં આવતી નથી.' : 'Your personal information is never sold or used for commercial advertising.'}</p>

        <h3>5. {isGu ? 'માહિતી શેરિંગ' : 'Information Sharing'}</h3>
        <p>{isGu ? 'માહિતી ફક્ત જ્યારે જરૂરી હોય ચારે તારે શેર કરવામાં આવે છે:' : 'Information may be shared only when necessary:'}</p>
        <ul>
          <li>{isGu ? 'ગુજરાત વન વિભાગના અધિકૃત અધિકારીઓ સાથે' : 'With authorized officers of the Gujarat Forest Department'}</li>
          <li>{isGu ? 'એપ્લિકેશન હોસ્ટિંગ, મેપિંગ સેવાઓ, cloud infrastructure અને ટેકનિકલ સપોર્ટ માટે જવાબદાર અધિકૃત સેવા પુરવઠા સાથે' : 'With authorized service providers responsible for application hosting, mapping services, cloud infrastructure, or technical support'}</li>
          <li>{isGu ? 'RECAP4NDC પ્રોજેક્ટ ભાગીદારો (GIZ) સાથે ફક્ત monitoring, reporting અને evaluation માટે સંગ્રહિત અથવા અજ્ઞાત સ્વરૂપમાં' : 'With RECAP4NDC project partners (such as GIZ) only in aggregated or anonymized form for monitoring, reporting, and evaluation purposes'}</li>
          <li>{isGu ? 'લાગુ કાયદા અનવયે જરૂરી હય એપ્લિકેશનની સુરક્ષા અને દટાજો઀ જાળવવા' : 'When required by applicable law or to protect the security and integrity of the application'}</li>
        </ul>
        <p>{isGu ? 'વપરાશકર્તાની માહિતી કદીએ તૃતીય પક્ષકારને વેચવામાં આવતી નથી.' : 'User information is never sold to third parties.'}</p>

        <h3>6. {isGu ? 'ડેટા સુરક્ષા' : 'Data Security'}</h3>
        <p>{isGu ? 'માહિતીને અનધિકૃત એક્સેસ, દુરુપયોગ, જાહેરાત, ફેરફાર અથવા નાશથી બચાવવા યોગ્ય વહીવટી, ટેકનિકલ અને ભૌતિક સુરક્ષા વ્યવસ્થા અમલમાં મૂકવામાં આવે છે.' : 'Appropriate administrative, technical, and physical safeguards are implemented to protect information from unauthorized access, misuse, disclosure, alteration, or destruction.'}</p>
        <p>{isGu ? 'કોઈપણ ઇલેક્ટ્રોનિક સિસ્ટમ સંપૂર્ણ સુરક્ષા આપી શકે નહીં, પરંતુ વપરાશકર્તાની માહિતી સુરક્ષિત કરવા industry-standard સુરક્ષા પદ્ધતિઓ અપનાવવામાં આવે છે.' : 'Although no electronic system can guarantee absolute security, industry-standard security practices are followed to safeguard user information.'}</p>

        <h3>7. {isGu ? 'તૃતીય-પક્ષ સેવાઓ' : 'Third-Party Services'}</h3>
        <p>{isGu ? 'એપ્લિકેશન કામગીરી માટે જરૂરી વિશ્વસનીય તૃતીય-પક્ષ સેવાઓ ઉપયોગમાં લઈ શકે:' : 'The application may use trusted third-party services necessary for its operation, including:'}</p>
        <ul>
          <li>{isGu ? 'Cloud hosting સેવાઓ' : 'Cloud hosting services'}</li>
          <li>{isGu ? 'મેપિંગ અને GIS સેવાઓ' : 'Mapping and GIS services'}</li>
          <li>{isGu ? 'ટેકનિકલ સપોર્ટ સેવયો' : 'Technical support services'}</li>
        </ul>
        <p>{isGu ? 'આ સેવયો લાગુ ગોપનીયતા અને સુરક્ષા જરૂરિયાતો અનવયે ફક્ત એપ્લિકેશન ચલાવવા માટે જરૂરી ઉપયોગમાં ડેટા પ્રોસેસ કરે છે.' : 'These services process data only as required for operating the application and in accordance with applicable privacy and security requirements.'}</p>

        <h3>8. {isGu ? 'બાળકોની ગોપનીયતા' : "Children's Privacy"}</h3>
        <p>{isGu ? 'FMPS ફક્ત અધિકૃત સરકારી અધિકારીઓ અને વન કર્મચારીઓ માટે છે.' : 'The FMPS (Forest Monitoring and Patrolling System) is intended exclusively for authorized government officials, forest personnel, and other authorized users.'}</p>
        <p>{isGu ? 'આ 18 વર્ષથી ોછીની વ્યક્તિઓ માટે ઊદ્દેશાયેલ નથી, અને એપ્લિકેશન બાળકો પાસેથી જાણી બુઝીને માહિતી એકત્રિત કરતું નથી.' : 'It is not intended for individuals under 18 years of age, and the application does not knowingly collect information from children.'}</p>

        <h3>9. {isGu ? 'અમગ્ને સંપર્ક કરો' : 'Contact Us'}</h3>
        <p>{isGu ? 'આ ગોપનીયતા નીતિ અંગે પ્રશ્નો માટે:' : 'For questions regarding this Privacy Policy or data protection practices, please contact:'}</p>
        <p>
          {isGu ? 'ગુજરાત વન વિભાગ' : 'Gujarat Forest Department'}<br />
          {isGu ? '– FMPS (વન મોનિટરિંગ અને પેટ્રોલિંગ સિસ્ટમ)' : '– FMPS (Forest Monitoring and Patrolling System)'}<br />
          Email: gujfdp@gmail.com
        </p>

        <Link to="/login" className="legal-back-link legal-back-link-bottom">
          {isGu ? '← લોગિન પર પાા જયો' : '← Back to Login'}
        </Link>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
