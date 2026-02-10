declare module 'dom-to-image-more' {
  export interface Options {
    width?: number;
    height?: number;
    style?: Record<string, string>;
    quality?: number;
    bgcolor?: string;
    imagePlaceholder?: string;
    cacheBust?: boolean;
  }

  const domToImage: {
    toBlob(node: HTMLElement, options?: Options): Promise<Blob>;
    toPng(node: HTMLElement, options?: Options): Promise<string>;
    toJpeg(node: HTMLElement, options?: Options): Promise<string>;
    toSvg(node: HTMLElement, options?: Options): Promise<string>;
  };

  export default domToImage;
}
