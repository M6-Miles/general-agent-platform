import type {Language} from '../../lib/i18n';

export type ToolConfiguration = {
  name: string;
  description: string;
  executor: string;
  riskLevel: string;
  timeoutMs: string;
  sideEffects: boolean;
  inputSchema: string;
  outputSchema: string;
};

export type ToolConfigurationSource = {
  name: string;
  description: string;
  executor: string;
  risk_level: string;
  timeout_ms: number;
  side_effects: boolean;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
};

export const emptyToolConfiguration: ToolConfiguration = {
  name: '',
  description: '',
  executor: '',
  riskLevel: 'low',
  timeoutMs: '5000',
  sideEffects: false,
  inputSchema: '{\n  "type": "object",\n  "properties": {}\n}',
  outputSchema: '{\n  "type": "object",\n  "properties": {}\n}',
};

export function toolConfigurationFrom(source: ToolConfigurationSource): ToolConfiguration {
  return {
    name: source.name,
    description: source.description,
    executor: source.executor,
    riskLevel: source.risk_level,
    timeoutMs: String(source.timeout_ms),
    sideEffects: source.side_effects,
    inputSchema: JSON.stringify(source.input_schema, null, 2),
    outputSchema: JSON.stringify(source.output_schema, null, 2),
  };
}

export type ToolConfigurationPayload = {
  name: string;
  description: string;
  executor: string;
  risk_level: string;
  timeout_ms: number;
  side_effects: boolean;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
};

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseToolConfiguration(
  value: ToolConfiguration,
  language: Language = 'zh',
): {data: ToolConfigurationPayload; error?: never} | {data?: never; error: string} {
  if (!value.name.trim() || !value.executor.trim()) {
    return {error: language === 'zh' ? '工具名称和执行器不能为空' : 'Tool name and executor are required'};
  }
  const timeoutMs = Number(value.timeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
    return {error: language === 'zh' ? '超时时间必须是 100 到 120000 之间的整数' : 'Timeout must be an integer from 100 to 120000'};
  }
  try {
    const inputSchema: unknown = JSON.parse(value.inputSchema);
    const outputSchema: unknown = JSON.parse(value.outputSchema);
    if (!isJsonObject(inputSchema) || !isJsonObject(outputSchema)) {
      return {error: language === 'zh' ? '输入和输出 Schema 必须是 JSON 对象' : 'Input and output schemas must be JSON objects'};
    }
    return {
      data: {
        name: value.name.trim(),
        description: value.description.trim(),
        executor: value.executor.trim(),
        risk_level: value.riskLevel,
        timeout_ms: timeoutMs,
        side_effects: value.sideEffects,
        input_schema: inputSchema,
        output_schema: outputSchema,
      },
    };
  } catch {
    return {error: language === 'zh' ? '输入和输出 Schema 必须是有效的 JSON' : 'Input and output schemas must be valid JSON'};
  }
}

type Props = {
  value: ToolConfiguration;
  onChange: (value: ToolConfiguration) => void;
  language?: Language;
  disabled?: boolean;
};

export default function ToolConfigurationForm({value, onChange, language = 'zh', disabled = false}: Props) {
  const zh = language === 'zh';
  const update = <K extends keyof ToolConfiguration>(key: K, next: ToolConfiguration[K]) => {
    onChange({...value, [key]: next});
  };

  return (
    <div className="tool-edit-form">
      <label><span>{zh ? '工具名称' : 'Tool name'} <b aria-hidden="true">*</b></span><input required disabled={disabled} value={value.name} maxLength={100} placeholder={zh ? '例如：订单查询' : 'e.g. Order lookup'} onChange={(event) => update('name', event.target.value)} /></label>
      <label><span>{zh ? '执行器' : 'Executor'} <b aria-hidden="true">*</b></span><input required disabled={disabled} value={value.executor} maxLength={100} placeholder="builtin.echo" onChange={(event) => update('executor', event.target.value)} /></label>
      <label className="tool-form-wide"><span>{zh ? '描述' : 'Description'}</span><textarea disabled={disabled} rows={3} maxLength={500} value={value.description} placeholder={zh ? '说明该工具能够完成什么任务' : 'Describe what this tool can do'} onChange={(event) => update('description', event.target.value)} /></label>
      <label><span>{zh ? '风险级别' : 'Risk level'}</span><select disabled={disabled} value={value.riskLevel} onChange={(event) => update('riskLevel', event.target.value)}><option value="low">{zh ? '低' : 'Low'}</option><option value="medium">{zh ? '中' : 'Medium'}</option><option value="high">{zh ? '高' : 'High'}</option><option value="critical">{zh ? '严重' : 'Critical'}</option></select></label>
      <label><span>{zh ? '超时时间（毫秒）' : 'Timeout (ms)'}</span><input disabled={disabled} type="number" min={100} max={120000} step={100} value={value.timeoutMs} onChange={(event) => update('timeoutMs', event.target.value)} /></label>
      <label className="tool-checkbox tool-form-wide"><input disabled={disabled} type="checkbox" checked={value.sideEffects} onChange={(event) => update('sideEffects', event.target.checked)} /><span>{zh ? '该工具会修改数据、发送请求或产生其他外部副作用' : 'This tool modifies data, sends requests, or has other external side effects'}</span></label>
      <label className="tool-form-wide"><span>{zh ? '输入 JSON Schema' : 'Input JSON Schema'}</span><textarea disabled={disabled} className="tool-code-input" rows={9} spellCheck={false} value={value.inputSchema} onChange={(event) => update('inputSchema', event.target.value)} /></label>
      <label className="tool-form-wide"><span>{zh ? '输出 JSON Schema' : 'Output JSON Schema'}</span><textarea disabled={disabled} className="tool-code-input" rows={9} spellCheck={false} value={value.outputSchema} onChange={(event) => update('outputSchema', event.target.value)} /></label>
    </div>
  );
}
