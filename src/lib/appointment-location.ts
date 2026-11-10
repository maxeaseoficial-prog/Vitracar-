export type AppointmentLocation = 'store' | 'customer'
const normalize=(value:string)=>value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').replace(/[.!]+$/,'')
// The existing address field stores either this canonical store marker or the actual customer address.
// Recognize the previous UI's markers without rewriting historical records.
const storeMarkers=new Set(['','na loja','loja','na unidade','no estabelecimento','no nosso estabelecimento'])
export function appointmentLocation(address:string|null|undefined):AppointmentLocation{
  return storeMarkers.has(normalize(address||''))?'store':'customer'
}
export function savedAppointmentAddress(location:AppointmentLocation,address:string):string{
  if(location==='store')return 'Na loja'
  const value=address.trim()
  if(value.length<8||appointmentLocation(value)==='store')throw new Error('Informe o endereço completo do cliente, com rua, número, bairro e cidade.')
  if(value.length>500)throw new Error('O endereço do cliente deve ter até 500 caracteres.')
  return value
}
/** Directions URL only; addresses are not sent to Google before the user clicks the link. */
export function customerDirections(address:string|null|undefined):string|null{
  if(!address?.trim()||appointmentLocation(address)==='store')return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}&travelmode=driving`
}
export function customerWhatsApp(value:string|null|undefined):string|null{
  let digits=(value||'').replace(/\D/g,'')
  if(digits.length===10||digits.length===11)digits='55'+digits
  if(!/^55[1-9][0-9]{9,10}$/.test(digits))return null
  return `https://wa.me/${digits}`
}
