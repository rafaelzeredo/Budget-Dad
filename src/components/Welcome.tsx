import { useRef, useState } from 'react';
import { BrandMark, Icon } from './ui';

export function Welcome({ onFile, error, busy, remember, setRemember }: { onFile: (f: File) => void; error?: string; busy?: boolean; remember: boolean; setRemember: (v: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <main className="welcome">
      <div className="welcome-card fade-in">
        <div className="brand"><BrandMark /> Budget Dad</div>
        <h1>As finanças do mês, claras e num só lugar.</h1>
        <p className="lead">Abra a planilha do orçamento (o arquivo <b>.ods</b> do modelo) e veja para onde foi o dinheiro, o que entrou, as parcelas e o patrimônio.</p>
        <label
          className={`drop ${over ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
        >
          {Icon.upload}
          <strong>{busy ? 'Lendo a planilha…' : 'Escolher a planilha'}</strong>
          <span>ou arraste o arquivo para cá</span>
          <input
            ref={input}
            type="file"
            accept=".ods,application/vnd.oasis.opendocument.spreadsheet"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </label>
        <label className="toggle remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Lembrar a planilha neste aparelho
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="privacy">
          {Icon.lock}
          <div>
            <b>Seus dados não saem deste aparelho.</b> A planilha é lida aqui mesmo, no navegador; nada é enviado para a internet nem guardado em servidor. O site não contém nenhum dado financeiro: ele só funciona com o arquivo que você abrir.
          </div>
        </div>
      </div>
    </main>
  );
}
