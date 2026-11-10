import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money } from '../lib/utils'

export function FinancialChart({chart}:{chart:{name:string;income:number;cost:number}[]}){
  return <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart} margin={{top:10,right:12,left:-18,bottom:0}}>
            <defs><linearGradient id="blueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0B0D12" stopOpacity={.18}/><stop offset="100%" stopColor="#0B0D12" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke="#F4F7F1" strokeDasharray="3 5" vertical={false}/>
            <XAxis dataKey="name" tick={{fill:'#9ca3af',fontSize:10}} axisLine={false} tickLine={false} dy={9}/>
            <YAxis tick={{fill:'#9ca3af',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${Math.round(Number(v)/100)}`} width={55}/>
            <Tooltip formatter={(v,name)=>[money(Number(v)),name==='income'?'Recebimentos':'Despesas']}
              contentStyle={{borderRadius:12,border:'1px solid #F4F7F1',boxShadow:'0 8px 26px #13274210',fontSize:11}}/>
            <Legend verticalAlign="bottom" height={22} formatter={v=>v==='income'?'Recebimentos':'Despesas'} wrapperStyle={{fontSize:10,paddingTop:14}}/>
            <Area type="monotone" dataKey="income" stroke="#0B0D12" strokeWidth={2.5} fill="url(#blueArea)" dot={false}/>
            <Area type="monotone" dataKey="cost" stroke="#0B0D12" strokeWidth={2} strokeDasharray="5 5" fill="transparent" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
}
