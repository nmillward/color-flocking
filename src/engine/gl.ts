// Small WebGL2 helpers: shader programs, textures, and render targets.

export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export interface FloatFormat {
  internalFormat: number;
  type: number;
  label: '32-bit float' | '16-bit float';
}

export function createTexture(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  internalFormat: number,
  format: number,
  type: number,
  filter: number,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Could not create texture');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
  return tex;
}

export function createTarget(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  internalFormat: number,
  format: number,
  type: number,
  filter: number,
): Target {
  const tex = createTexture(gl, w, h, internalFormat, format, type, filter);
  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error('Could not create framebuffer');
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo, w, h };
}

export function deleteTarget(gl: WebGL2RenderingContext, t: Target) {
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}

/** Pick the most precise float format this device can render into. */
export function detectFloatFormat(gl: WebGL2RenderingContext): FloatFormat | null {
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');
  const candidates: FloatFormat[] = [
    { internalFormat: gl.RGBA32F, type: gl.FLOAT, label: '32-bit float' },
    { internalFormat: gl.RGBA16F, type: gl.HALF_FLOAT, label: '16-bit float' },
  ];
  for (const c of candidates) {
    const t = createTarget(gl, 2, 2, c.internalFormat, gl.RGBA, c.type, gl.NEAREST);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    deleteTarget(gl, t);
    if (ok) return c;
  }
  return null;
}

export class Program {
  readonly handle: WebGLProgram;
  private locs = new Map<string, WebGLUniformLocation | null>();

  constructor(
    private gl: WebGL2RenderingContext,
    vertSrc: string,
    fragSrc: string,
    name: string,
  ) {
    const vs = compile(gl, gl.VERTEX_SHADER, vertSrc, name);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc, name);
    const prog = gl.createProgram();
    if (!prog) throw new Error(`Could not create program "${name}"`);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program "${name}" failed to link: ${gl.getProgramInfoLog(prog)}`);
    }
    this.handle = prog;
  }

  use() {
    this.gl.useProgram(this.handle);
  }

  private loc(name: string) {
    if (!this.locs.has(name)) this.locs.set(name, this.gl.getUniformLocation(this.handle, name));
    return this.locs.get(name) ?? null;
  }

  float(name: string, v: number) {
    this.gl.uniform1f(this.loc(name), v);
  }
  vec2(name: string, x: number, y: number) {
    this.gl.uniform2f(this.loc(name), x, y);
  }
  vec3(name: string, x: number, y: number, z: number) {
    this.gl.uniform3f(this.loc(name), x, y, z);
  }
  vec3v(name: string, values: Float32Array) {
    this.gl.uniform3fv(this.loc(name), values);
  }
  int(name: string, v: number) {
    this.gl.uniform1i(this.loc(name), v);
  }
  ivec2(name: string, x: number, y: number) {
    this.gl.uniform2i(this.loc(name), x, y);
  }
  uint(name: string, v: number) {
    this.gl.uniform1ui(this.loc(name), v >>> 0);
  }
  texture(name: string, unit: number, tex: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(this.loc(name), unit);
  }

  destroy() {
    this.gl.deleteProgram(this.handle);
  }
}

function compile(gl: WebGL2RenderingContext, type: number, src: string, name: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader "${name}" failed to compile: ${log}`);
  }
  return shader;
}
