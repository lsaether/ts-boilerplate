import axios, { AxiosInstance } from "axios";

export default class PolkascanAPI {
  private ax: AxiosInstance;
  private url: string;

  constructor(url = "https://explorer-31.polkascan.io/polkadot/api/v1") {
    this.url = url;
    this.ax = axios.create({
      baseURL: url,
      timeout: 2000,
    });
  }

  async getUnbonding(): Promise<any> {
    const num = 1;
    const page = `&page[number]=${num}`;
    const res = await this.ax.get(
      `/event?filter[module_id]=staking&filter[event_id]=Unbonded${page}&page[size]=25`
    );

    console.log(res.data.data[0].attributes);
  }
}
