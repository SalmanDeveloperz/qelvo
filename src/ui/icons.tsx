import type { SVGProps } from "react";
import { LOCKUP, MARK, WORDMARK } from "./brand.gen";

type P = SVGProps<SVGSVGElement> & { size?: number };
const S = ({ size = 16, children, ...p }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    {children}
  </svg>
);

export const IUpload = (p: P) => <S {...p}><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></S>;
export const IDownload = (p: P) => <S {...p}><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></S>;
export const ICode = (p: P) => <S {...p}><path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" /></S>;
export const IForm = (p: P) => <S {...p}><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 9h8M8 12.5h8M8 16h5" /></S>;
export const ICheck = (p: P) => <S {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></S>;
export const IChevron = (p: P) => <S {...p}><path d="m9 6 6 6-6 6" /></S>;
export const IArrowLeft = (p: P) => <S {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></S>;
export const IArrowRight = (p: P) => <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>;
export const IPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const ITrash = (p: P) => <S {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></S>;
export const IUp = (p: P) => <S {...p}><path d="m6 14 6-6 6 6" /></S>;
export const IDown = (p: P) => <S {...p}><path d="m6 10 6 6 6-6" /></S>;
export const ILink = (p: P) => <S {...p}><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></S>;
export const IX = (p: P) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>;
export const IMinus = (p: P) => <S {...p}><path d="M5 12h14" /></S>;
export const IFit = (p: P) => <S {...p}><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></S>;
export const IWarn = (p: P) => <S {...p}><path d="M12 4 2.8 19.5h18.4L12 4z" /><path d="M12 10v4.5M12 17.3v.2" /></S>;
export const IInfo = (p: P) => <S {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" /></S>;
export const IDots = (p: P) => <S {...p}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></S>;
export const ICopy = (p: P) => <S {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></S>;
export const IFile = (p: P) => <S {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></S>;
export const ISpark = (p: P) => <S {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></S>;
export const IPen = (p: P) => <S {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></S>;
export const ILock = (p: P) => <S {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></S>;

/** The Qelvo mark: the ring takes the text colour and the baseline rule the theme accent. */
export const Logo = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="12 12 76 76" aria-hidden className="brand-mark">
    <g transform={`translate(${MARK.shift.x} ${MARK.shift.y})`}>
      <path d={MARK.ring} style={{ fill: "var(--text)" }} />
      <rect x={MARK.bar.x} y={MARK.bar.y} width={MARK.bar.w} height={MARK.bar.h} style={{ fill: "var(--accent)" }} />
    </g>
  </svg>
);

/** Mark + wordmark in theme colours. The accent rule sits on the wordmark's baseline. */
export const Wordmark = ({ height = 30 }: { height?: number }) => (
  <svg height={height} width={(height * LOCKUP.W) / 100} viewBox={`0 0 ${LOCKUP.W} 100`} role="img" aria-label="Qelvo" className="wordmark">
    <g transform={`translate(${LOCKUP.tx} ${LOCKUP.ty}) scale(${LOCKUP.k})`}>
      <g transform={`translate(${MARK.shift.x} ${MARK.shift.y})`}>
        <path d={MARK.ring} style={{ fill: "var(--text)" }} />
        <rect x={MARK.bar.x} y={MARK.bar.y} width={MARK.bar.w} height={MARK.bar.h} style={{ fill: "var(--accent)" }} />
      </g>
    </g>
    <path d={WORDMARK.d} transform={`translate(${LOCKUP.wordX} ${LOCKUP.B})`} style={{ fill: "var(--text)" }} />
  </svg>
);
export const IUndo = (p: P) => <S {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></S>;
export const IRedo = (p: P) => <S {...p}><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></S>;
export const IGitHub = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);
