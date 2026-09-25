// Independence + not-advice notice. MillionTSP's name and branding reference
// the federal Thrift Savings Plan, so App Review (Guidelines 5.2.1 / 5.2.5)
// and users both need to be told plainly that this isn't a government app.
export default function Disclaimer({ className = '', style }) {
  return (
    <p className={`text-center text-[11px] leading-relaxed ${className}`} style={style}>
      MillionTSP is an independent app and is not affiliated with, endorsed by, or
      sponsored by the Federal Retirement Thrift Investment Board, the Thrift Savings
      Plan, or any U.S. government agency. Figures are estimates for informational
      purposes only and are not financial, tax, or investment advice.
    </p>
  );
}
