import { MapPin, MessageCircle, Navigation, Store } from 'lucide-react'
import { appointmentLocation, customerDirections, customerWhatsApp } from '../../lib/appointment-location'
import './appointment-location.css'

export function AppointmentContact({address,phone}:{address:string|null|undefined;phone:string|null|undefined}){
  const external=appointmentLocation(address)==='customer'
  const maps=external?customerDirections(address):null
  const whatsapp=customerWhatsApp(phone)
  return <div className="wash-contact">
    <span className={`wash-location-badge ${external?'is-external':''}`}>
      {external?<MapPin size={12} aria-hidden="true"/>:<Store size={12} aria-hidden="true"/>}
      {external?'No endereço do cliente':'Na loja'}
    </span>
    {external&&<>
      <p className="wash-customer-address" title={address||undefined}>{address}</p>
      <div className="wash-contact-actions">
        {whatsapp?<a href={whatsapp} target="_blank" rel="noopener noreferrer" draggable={false}><MessageCircle size={14} aria-hidden="true"/>WhatsApp</a>:
          <span className="wash-contact-disabled" role="link" aria-disabled="true" title="Cadastre um WhatsApp válido no perfil do cliente."><MessageCircle size={14} aria-hidden="true"/>Sem WhatsApp</span>}
        {maps&&<a href={maps} target="_blank" rel="noopener noreferrer" draggable={false} className="wash-maps-link"><Navigation size={14} aria-hidden="true"/>Ir até o cliente</a>}
      </div>
    </>}
  </div>
}
