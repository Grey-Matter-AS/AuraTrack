import { useTranslation } from 'react-i18next';
import pkg from '../../package.json';
import { ScrollFade } from '../components/ScrollFade';

const GITHUB_URL = 'https://github.com/Grey-Matter-AS/AuraTrack';

export default function AboutView({ onBack }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col w-full max-w-md sm:max-w-xl md:max-w-2xl overflow-hidden">

      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          {t('nav.back')}
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
          {t('about.title')}
        </h2>
      </div>

      <ScrollFade className="space-y-4" wrapperClassName="flex-1">

        <div className="text-center py-5">
          <h1 className="text-2xl font-black tracking-[0.3em] uppercase" style={{ color: 'var(--text-primary)' }}>
            AURATRACK
          </h1>
          <div className="h-1 w-8 bg-[var(--accent)] mx-auto mt-2 rounded-full" />
          <span
            className="inline-block mt-3 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
          >
            v{pkg.version}
          </span>
        </div>

        <Section title={t('about.section_about')}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('about.about_text')}
          </p>
        </Section>

        <Section title={t('about.section_developer')}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Grey Matter AS</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent)', border: '1px solid var(--border)' }}
            >
              {t('about.github')}
            </a>
          </div>
        </Section>

        <Section title={t('about.section_privacy')}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('about.privacy_text')}
          </p>
        </Section>

        <Section title={t('about.section_disclaimer')}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('about.disclaimer_text')}
          </p>
        </Section>

        <Section title={t('about.section_opensource')}>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            {t('about.opensource_text')}
          </p>
          <div className="flex gap-3">
            <a
              href={`${GITHUB_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-[11px] font-bold py-2.5 rounded-xl active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              {t('about.license')}
            </a>
            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-[11px] font-bold py-2.5 rounded-xl active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {t('about.report_issue')}
            </a>
          </div>
        </Section>

        <div className="pb-4" />
      </ScrollFade>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
