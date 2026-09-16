import {describe, expect, it} from 'vitest';
import {emptyToolConfiguration, parseToolConfiguration} from './ToolConfigurationForm';

describe('parseToolConfiguration', () => {
  it('normalizes a valid form for both create and edit requests', () => {
    const result = parseToolConfiguration({...emptyToolConfiguration, name: '  查询工具  ', executor: ' builtin.echo '});
    expect(result.data).toMatchObject({name: '查询工具', executor: 'builtin.echo', timeout_ms: 5000});
  });

  it('rejects arrays and invalid timeout values before a request is sent', () => {
    const schemaResult = parseToolConfiguration({...emptyToolConfiguration, name: '查询', executor: 'echo', inputSchema: '[]'});
    expect(schemaResult.error).toContain('JSON 对象');
    const timeoutResult = parseToolConfiguration({...emptyToolConfiguration, name: '查询', executor: 'echo', timeoutMs: '1.5'});
    expect(timeoutResult.error).toContain('整数');
  });
});
