import './globals.css';import type {Metadata} from 'next';
export const metadata:Metadata={title:'TradeSignal Pro | Binance Futures Signal Research',description:'Read-only SOL BTC ETH futures technical signals and historical backtesting'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
