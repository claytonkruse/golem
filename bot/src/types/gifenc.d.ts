// gifenc ships without types. These cover the parts Golem uses.
declare module 'gifenc' {
	type Palette = number[][];
	type FrameOptions = { palette?: Palette; delay?: number; repeat?: number };
	type Encoder = {
		writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void;
		finish(): void;
		bytes(): Uint8Array;
	};
	const gifenc: {
		GIFEncoder(): Encoder;
		quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): Palette;
		applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette): Uint8Array;
	};
	export default gifenc;
}
