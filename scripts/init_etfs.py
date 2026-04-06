import os
from supabase import create_client
from dotenv import load_dotenv


load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

ETF_LIST = [
    "VOO","SPY","IVV","VTI","SPLG","SCHB","ITOT","QQQ","QQQM","DIA",
    "SCHD","VUG","VTV","IWF","IWD","DGRO","VIG","QUAL","MTUM","IWM",
    "VXUS","IXUS","VEA","IEFA","VWO","IEMG","EEM","SCHF","SCHY","ACWI",
    "BND","AGG","BNDX","LQD","HYG","TIP","IEF","TLT","SHY","MUB",
    "VNQ","XLK","XLF","XLE","XLV","XLY","XLI","XLP","XLU","JEPI","SGOV","XLRE"
]

for symbol in ETF_LIST:
    supabase.table("etfs").upsert({
        "symbol": symbol,
        "name": symbol
    }).execute()

print("done")
