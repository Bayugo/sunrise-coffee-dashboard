"""Build the three CSVs the dashboard reads from the raw DataDNA tables.

Usage (from the repo root):
    pip install pandas
    python scripts/prepare_data.py

Reads  data/raw/*.csv
Writes data/store_monthly_pl.csv, data/daily_sales.csv, data/product_catalogue.csv
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"


def main() -> None:
    store = pd.read_csv(RAW / "dim_store.csv")
    product = pd.read_csv(RAW / "dim_product.csv")
    date = pd.read_csv(RAW / "dim_date.csv")
    daily = pd.read_csv(RAW / "fact_daily_sales.csv")
    monthly = pd.read_csv(RAW / "fact_store_monthly_profitability.csv")

    # --- integrity checks promised by the data dictionary ---
    pl_check = (
        monthly.total_monthly_revenue_gbp
        - monthly.total_monthly_cogs_gbp
        - monthly.monthly_rent_gbp
        - monthly.monthly_staffing_cost_gbp
        - monthly.loyalty_redemption_cost_gbp
        - monthly.net_profit_gbp
    ).abs().max()
    streams = ["espresso_revenue_gbp", "filter_revenue_gbp", "food_revenue_gbp", "retail_beans_revenue_gbp"]
    mix_check = (daily[streams].sum(axis=1) - daily.total_revenue_gbp).abs().max()
    assert pl_check < 0.01, f"net profit does not reconcile ({pl_check})"
    assert mix_check < 0.01, f"revenue streams do not sum to total ({mix_check})"
    dupes = daily.duplicated(["store_id", "date_id"]).sum()
    print(f"P&L reconciles; revenue streams reconcile; {dupes} repeated store-days in the daily sample")

    # --- store x month P&L with store attributes ---
    store_cols = ["store_id", "store_name", "store_format", "location_type", "city", "region",
                  "store_status", "loyalty_adoption_rate", "opening_year"]
    pl = monthly.merge(store[store_cols], on="store_id", how="left")
    pl_cols = ["month_id", "store_id", "store_name", "store_format", "location_type", "city", "region",
               "store_status", "opening_year", "loyalty_adoption_rate", "total_monthly_revenue_gbp",
               "total_monthly_cogs_gbp", "monthly_rent_gbp", "monthly_staffing_cost_gbp",
               "loyalty_redemption_cost_gbp", "net_profit_gbp", "net_profit_margin_pct", "avg_daily_footfall",
               "loyalty_member_revenue_pct", "loyalty_member_spend_gbp", "revenue_per_sqft_gbp", "rent_band",
               "profitability_status"]
    pl[pl_cols].sort_values(["store_id", "month_id"]).to_csv(OUT / "store_monthly_pl.csv", index=False)

    # --- daily sample with calendar, store and top-product attributes ---
    d = (daily
         .merge(date[["date_id", "full_date", "year", "quarter", "month_number", "day_of_week",
                      "is_weekend", "uk_trading_calendar"]], on="date_id", how="left")
         .merge(store[["store_id", "store_format", "region"]], on="store_id", how="left")
         .merge(product[["product_id", "product_category"]], on="product_id", how="left"))
    d_cols = ["daily_sale_id", "store_id", "full_date", "year", "quarter", "month_number", "day_of_week",
              "is_weekend", "uk_trading_calendar", "store_format", "region", "product_category",
              "total_revenue_gbp", "total_transactions", "loyalty_transactions", "loyalty_redemption_cost_gbp",
              *streams, "daily_gross_profit_gbp", "total_staff_hours"]
    d[d_cols].sort_values("daily_sale_id").to_csv(OUT / "daily_sales.csv", index=False)

    product.to_csv(OUT / "product_catalogue.csv", index=False)
    print("Wrote", ", ".join(p.name for p in [OUT / "store_monthly_pl.csv", OUT / "daily_sales.csv",
                                               OUT / "product_catalogue.csv"]))


if __name__ == "__main__":
    main()
