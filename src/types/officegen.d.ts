declare module 'officegen' {
    interface OfficegenOptions {
        type: string;
        [key: string]: any;
    }

    interface Officegen {
        (options: OfficegenOptions): any;
        [key: string]: any;
    }

    const officegen: Officegen;
    export = officegen;
}
