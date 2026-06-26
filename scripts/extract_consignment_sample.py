"""
위수탁부담금 검증용 샘플 데이터 추출 스크립트
- 대상: 2026-01-01 이후 주문건 중 100건 무작위 추출
- 출력: consignment_sample.xlsx (product_ocode / part / consignment_charge)
- 실행: python scripts/extract_consignment_sample.py
"""

import os
import sys
import pandas as pd
from datetime import datetime
from sshtunnel import SSHTunnelForwarder
import pymysql

# ---------------------------------------------------------------------------
# 접속 설정 — .env 파일 또는 환경변수에서 읽음
# ---------------------------------------------------------------------------
SSH_HOST     = os.environ.get("SSH_HOST", "")
SSH_PORT     = int(os.environ.get("SSH_PORT", 22))
SSH_USER     = os.environ.get("SSH_USER", "")
SSH_KEY_PATH = os.environ.get("SSH_KEY_PATH", "")

DB_HOST     = os.environ.get("DB_HOST", "127.0.0.1")
DB_PORT     = int(os.environ.get("DB_PORT", 3306))
DB_USER     = os.environ.get("DB_USER", "")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_NAME     = os.environ.get("DB_NAME", "")

START_DATE = "2026-01-01 00:00:00"
END_DATE   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
SAMPLE_N   = 100

# ---------------------------------------------------------------------------
# 상수 (queries.ts 와 동일)
# ---------------------------------------------------------------------------
PB_CODES = (
    "'9000001','9000064','9000705','9009998','9010131',"
    "'9010173','9010190','9000030','9010256','9010269'"
)
EXCL_USERS = (
    "'ptest','ptest2','cafebiteme_SS','cafebiteme_YN','bite1008','cafebiteme_CG'"
)
EXCL_STATES = "'10','50','65','70','95','99'"

# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------
INNER_SQL = f"""
    SELECT
      wt_order_product.reg_date AS DAY,
      wt_order_product.ocode,
      wt_order_product.product_ocode,
      wt_order_product.product_cd,
      wt_order_product.product_nm,
      wt_order_product.qty,
      wt_product.brand_cd,
      IFNULL(wt_code2.code_nm2, wt_product.brand_cd) AS brand_nm,
      CASE WHEN wt_order_info.user_id IS NULL THEN '비회원'
           ELSE wt_order_info.user_id
      END AS userid,
      CASE
        WHEN wt_admin.company_nm NOT LIKE '%바잇미%' THEN '위탁'
        WHEN wt_admin.company_nm LIKE '%바잇미%'
             AND wt_product.brand_cd IN ({PB_CODES}) THEN 'PB'
        WHEN wt_admin.company_nm LIKE '%바잇미%'
             AND wt_product.brand_cd NOT IN ({PB_CODES}) THEN '사입'
        ELSE '미분류'
      END AS part,
      wt_order_product.total_price AS price,
      CASE
        WHEN wt_order_product.coupon_use_yn = 'n' THEN 0
        WHEN wt_order_product.division_coupon_product_price < 5 THEN 0
        ELSE wt_order_product.division_coupon_product_price
      END AS coupon,
      wt_order_product.division_reserve_product_price AS reserve_raw,
      wt_order_product.division_deposit_product_price AS deposit_raw,
      ROUND(IF(SUM(wt_order_product.total_price) = 0,
        ROUND(wt_order_product_trans.trans_price /
              COUNT(wt_order_product.product_ocode)
              OVER (PARTITION BY wt_order_product.product_trans_seq, wt_order_product.ocode), 0),
        IF(wt_order_info.trans_price = 0, 0,
           wt_order_product_trans.trans_price *
           (wt_order_product.total_price / SUM(wt_order_product.total_price)
            OVER (PARTITION BY wt_order_product.product_trans_seq, wt_order_product.ocode))
           + wt_order_product_trans.add_trans_price *
           (wt_order_product.total_price / SUM(wt_order_product.total_price)
            OVER (PARTITION BY wt_order_product.product_trans_seq, wt_order_product.ocode)))), 0) AS trans,
      wt_order_info.reserve_dc_trans_price AS trans_reserve,
      wt_order_info.deposit_dc_trans_price AS trans_deposit,
      IFNULL(wt_order_product.allocation_rate, 0) / 100 AS allocation_rate
    FROM wt_order_product
    LEFT JOIN wt_order_info         ON wt_order_product.ocode          = wt_order_info.ocode
    LEFT JOIN wt_order_product_trans ON wt_order_product.product_ocode = wt_order_product_trans.product_ocode
    LEFT JOIN wt_product            ON wt_order_product.product_cd     = wt_product.product_cd
    LEFT JOIN wt_admin              ON wt_order_product.supplier       = wt_admin.`no`
    LEFT JOIN wt_product_category   ON wt_order_product.product_cd     = wt_product_category.product_cd
    LEFT JOIN wt_code2              ON wt_product.brand_cd             = wt_code2.code_cd2
    WHERE wt_order_info.order_yn = 'y'
      AND wt_order_product.product_nm NOT LIKE '%응모권%'
      AND wt_order_product.product_order_state_cd NOT IN ({EXCL_STATES})
      AND (wt_order_info.user_id IS NULL
           OR wt_order_info.user_id NOT IN ({EXCL_USERS}))
      AND wt_order_product.reg_date BETWEEN '{START_DATE}' AND '{END_DATE}'
      AND wt_product_category.repre_category_yn = 'y'
    GROUP BY wt_order_product.product_ocode
"""

MAIN_SQL = f"""
SELECT
  product_ocode,
  part,
  CASE WHEN part = '위탁'
    THEN coupon
      + (reserve_raw + IF(trans = 0, 0,
                 IF(trans_reserve = 0, 0,
                    ROUND(trans_reserve * (trans / SUM(trans) OVER (PARTITION BY ocode)), 0)
                 )))
      + (deposit_raw + IF(trans = 0, 0,
                 IF(trans_deposit = 0, 0,
                    ROUND(trans_deposit * (trans / SUM(trans) OVER (PARTITION BY ocode)), 0)
                 )))
      - (coupon * allocation_rate)
    ELSE 0
  END AS consignment_charge
FROM ({INNER_SQL}) AS sub
"""


def validate_env():
    missing = [k for k, v in {
        "SSH_HOST": SSH_HOST, "SSH_USER": SSH_USER, "SSH_KEY_PATH": SSH_KEY_PATH,
        "DB_USER": DB_USER, "DB_PASSWORD": DB_PASSWORD, "DB_NAME": DB_NAME,
    }.items() if not v]
    if missing:
        print(f"[오류] 환경변수 누락: {', '.join(missing)}")
        print("  .env 파일에 값을 채운 뒤 다시 실행하세요.")
        sys.exit(1)


def fetch_data() -> pd.DataFrame:
    print(f"[1/3] SSH 터널 연결 중... ({SSH_HOST}:{SSH_PORT})")
    with SSHTunnelForwarder(
        (SSH_HOST, SSH_PORT),
        ssh_username=SSH_USER,
        ssh_pkey=SSH_KEY_PATH,
        remote_bind_address=(DB_HOST, DB_PORT),
    ) as tunnel:
        print(f"[2/3] DB 쿼리 실행 중... ({START_DATE} ~ {END_DATE})")
        conn = pymysql.connect(
            host="127.0.0.1",
            port=tunnel.local_bind_port,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            charset="utf8mb4",
        )
        try:
            df = pd.read_sql(MAIN_SQL, conn)
        finally:
            conn.close()
    return df


def main():
    validate_env()

    df = fetch_data()
    print(f"    전체 조회 건수: {len(df):,}건")

    sample = df.sample(n=min(SAMPLE_N, len(df)), random_state=42)
    sample = (
        sample[["product_ocode", "part", "consignment_charge"]]
        .sort_values("product_ocode")
        .set_index("product_ocode")
    )

    out_path = os.path.join(os.path.dirname(__file__), "consignment_sample.xlsx")
    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        sample.to_excel(writer, sheet_name="위수탁부담금_샘플")

        ws = writer.sheets["위수탁부담금_샘플"]
        ws.column_dimensions["A"].width = 18
        ws.column_dimensions["B"].width = 10
        ws.column_dimensions["C"].width = 20

    print(f"[3/3] 저장 완료 → {out_path}")
    print(f"    추출 샘플: {len(sample)}건")


if __name__ == "__main__":
    main()
