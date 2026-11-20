import { useState } from 'react'
import { FileInput, RotateCcw } from 'lucide-react'
import { dateInput, fromInput, span, type Policy, type Workspace } from './domain'
import { isCloudModel } from './intake'
import { policyIssues } from './scheduler'
import { Field, Label, Notice, Select, type Translate } from './ui'

const toClock = (n: number) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')
const parseClock = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m }
export function Settings({ workspace, model, models, online, t, savePolicy, saveModel, check, onImport, onReset }: {
  workspace: Workspace; model: string; models: string[]; online: boolean; t: Translate; savePolicy: (policy: Policy, now: number) => void;
  saveModel: (value: string) => void; check: () => void; onImport: () => void; onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const old = workspace.policy
  const [daily, setDaily] = useState(old.daily?.toString() || '')
  const [weekly, setWeekly] = useState(old.weekly?.toString() || '')
  const [overload, setOverload] = useState(old.overload ? String(Math.round(old.overload * 100)) : '')
  const [breaks, setBreaks] = useState(old.breaks?.[0] ? [toClock(old.breaks[0].start), toClock(old.breaks[0].end)] : ['', ''])
  const [reserve, setReserve] = useState(old.reserve?.[0] ? [toClock(old.reserve[0].start), toClock(old.reserve[0].end)] : ['', ''])
  const [reserveDay, setReserveDay] = useState(old.reserveDay)
  const [clock, setClock] = useState(dateInput(workspace.now))
  const [chosenModel, setChosenModel] = useState(model)
  const [error, setError] = useState(false)
  function interval(value: string[], extra: { start: number; end: number }[]) {
    if (!value[0] && !value[1]) return extra
    if (!value[0] || !value[1]) return null
    return [span(parseClock(value[0]), parseClock(value[1])), ...extra]
  }
  return <div className="stack">
    <div className="actions"><button className="btn secondary slim" onClick={onImport}><FileInput size={15} />{t('Import team CSV', '팀 CSV 가져오기')}</button></div>
    <section className="settings-section"><h3>{t('Local Ollama', '로컬 Ollama')}</h3><p>{t('Read installed models through the local Ollama API.', '로컬 Ollama API에서 설치된 모델을 읽습니다.')}</p><div className="field-line"><Label tone={online ? 'green' : 'peach'}>{online ? t('Connected', '연결됨') : t('Offline', '오프라인')}</Label><button className="btn secondary slim" onClick={check}>{t('Check connection', '연결 확인')}</button></div>
      <form className="field-line grow" onSubmit={(event) => { event.preventDefault(); if (chosenModel.trim() && !isCloudModel(chosenModel)) saveModel(chosenModel.trim()) }}><Field label={t('Ollama model', 'Ollama 모델')} hint={isCloudModel(chosenModel) ? t('Choose an installed local model.', '설치된 로컬 모델을 선택하세요.') : undefined}><input list="ollama-models" value={chosenModel} onChange={(event) => setChosenModel(event.target.value)} /><datalist id="ollama-models">{models.map((id) => <option key={id} value={id} />)}</datalist></Field><button className="btn secondary slim" type="submit" disabled={!chosenModel.trim() || isCloudModel(chosenModel)}>{t('Save model', '모델 저장')}</button></form>
    </section>
    <form className="settings-section stack" onSubmit={(event) => {
      event.preventDefault()
      const next = { ...old, daily: Number(daily), weekly: Number(weekly), overload: Number(overload) / 100, breaks: interval(breaks, old.breaks?.slice(1) || []), reserve: interval(reserve, old.reserve?.slice(1) || []), reserveDay }
      const now = fromInput(clock)
      setError(!!policyIssues(next).length || now === null)
      if (!policyIssues(next).length && now !== null) savePolicy(next, now)
    }}>
      <h3>{t('Company policy', '회사 정책')} <Label tone="peach">{t('Demo settings', '데모 설정')}</Label></h3>
      <Field label={t('Workspace clock · Asia/Seoul', '워크스페이스 기준 시각 · Asia/Seoul')}><input type="datetime-local" required value={clock} onChange={(event) => setClock(event.target.value)} /></Field>
      <div className="form-grid">
        <Field label={t('Daily work limit · minutes', '일일 업무 한도 · 분')}><input type="number" min={1} max={1440} required value={daily} onChange={(event) => setDaily(event.target.value)} /></Field>
        <Field label={t('Weekly work limit · minutes', '주간 업무 한도 · 분')}><input type="number" min={1} max={10080} required value={weekly} onChange={(event) => setWeekly(event.target.value)} /></Field>
        <Field label={t('Daily break starts', '일일 휴식 시작')}><input type="time" value={breaks[0]} onChange={(event) => setBreaks([event.target.value, breaks[1]])} /></Field>
        <Field label={t('Daily break ends', '일일 휴식 종료')}><input type="time" value={breaks[1]} onChange={(event) => setBreaks([breaks[0], event.target.value])} /></Field>
        <Field label={t('Reserved capacity starts', '예비 시간 시작')}><input type="time" value={reserve[0]} onChange={(event) => setReserve([event.target.value, reserve[1]])} /></Field>
        <Field label={t('Reserved capacity ends', '예비 시간 종료')}><input type="time" value={reserve[1]} onChange={(event) => setReserve([reserve[0], event.target.value])} /></Field>
        <Field label={t('Reserve weekday', '예비 시간 요일')}><Select value={reserveDay} onChange={(event) => setReserveDay(Number(event.target.value))}>{[t('Sunday', '일요일'), t('Monday', '월요일'), t('Tuesday', '화요일'), t('Wednesday', '수요일'), t('Thursday', '목요일'), t('Friday', '금요일'), t('Saturday', '토요일')].map((day, i) => <option key={i} value={i}>{day}</option>)}</Select></Field>
        <Field label={t('Overload threshold · %', '과부하 기준 · %')}><input type="number" min={1} max={100} required value={overload} onChange={(event) => setOverload(event.target.value)} /></Field>
      </div>
      {error && <Notice tone="red">{t('Complete the policy fields. Each time range must end after it starts.', '정책 항목을 확인하세요. 종료 시각은 시작 이후여야 합니다.')}</Notice>}
      <div className="actions"><button className="btn primary" type="submit">{t('Save demo policy', '데모 정책 저장')}</button></div>
    </form>
    <section className="settings-section"><h3>{t('Reset demo workspace', '데모 워크스페이스 초기화')}</h3>
      <p>{t('Clears assignments, reviews, scans, imports, and policy edits in this browser and restores the seeded calendar.', '이 브라우저의 배정, 검토, 스캔, 가져오기, 정책 변경을 지우고 기본 캘린더로 되돌립니다.')}</p>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>{confirmReset
        ? <><button className="btn danger-solid slim" onClick={onReset}><RotateCcw size={14} />{t('Yes, reset everything', '모두 초기화')}</button><button className="btn secondary slim" onClick={() => setConfirmReset(false)}>{t('Cancel', '취소')}</button></>
        : <button className="btn secondary slim danger" onClick={() => setConfirmReset(true)}><RotateCcw size={14} />{t('Reset workspace', '워크스페이스 초기화')}</button>}</div>
    </section>
  </div>
}
