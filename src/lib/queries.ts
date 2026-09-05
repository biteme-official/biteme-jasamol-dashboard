const PB_BRAND_CODES = [
  "9000001", "9000064", "9000705", "9009998", "9010131",
  "9010173", "9010190", "9000030", "9010256", "9010269",
];

const EXCLUDED_USER_IDS = [
  "ptest", "ptest2", "cafebiteme_SS", "cafebiteme_YN",
  "bite1008", "cafebiteme_CG",
];

const EXCLUDED_ORDER_STATES = ["10", "50", "65", "70", "95", "99"];

const PB = PB_BRAND_CODES.map((v) => `'${v}'`).join(",");
const USERS = EXCLUDED_USER_IDS.map((v) => `'${v}'`).join(",");
const STATES = EXCLUDED_ORDER_STATES.map((v) => `'${v}'`).join(",");

function fmt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function innerSubquery(start: Date, end: Date): string {
  return `
    SELECT
      wt_order_product.reg_date AS DAY,
      wt_order_product.ocode,
      wt_order_product.product_ocode,
      wt_order_product.product_cd,
      wt_product.product_nm,
      wt_order_product.qty,
      wt_product.brand_cd,
      IFNULL(wt_code2.code_nm2, wt_product.brand_cd) AS brand_nm,
      CASE WHEN wt_order_info.user_id IS NULL THEN '비회원'
           ELSE wt_order_info.user_id
      END AS userid,
      CASE
        WHEN wt_admin.company_nm NOT LIKE '%바잇미%' THEN '위탁'
        WHEN wt_admin.company_nm LIKE '%바잇미%'
             AND wt_product.brand_cd IN (${PB}) THEN 'PB'
        WHEN wt_admin.company_nm LIKE '%바잇미%'
             AND wt_product.brand_cd NOT IN (${PB}) THEN '사입'
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
    LEFT JOIN wt_order_info        ON wt_order_product.ocode         = wt_order_info.ocode
    LEFT JOIN wt_order_product_trans ON wt_order_product.product_ocode = wt_order_product_trans.product_ocode
    LEFT JOIN wt_product           ON wt_order_product.product_cd    = wt_product.product_cd
    LEFT JOIN wt_admin             ON wt_order_product.supplier      = wt_admin.\`no\`
    LEFT JOIN wt_product_category  ON wt_order_product.product_cd    = wt_product_category.product_cd
    LEFT JOIN wt_code2             ON wt_product.brand_cd            = wt_code2.code_cd2
    WHERE wt_order_info.order_yn = 'y'
      AND wt_order_product.product_nm NOT LIKE '%응모권%'
      AND wt_order_product.product_order_state_cd NOT IN (${STATES})
      AND (wt_order_info.user_id IS NULL
           OR wt_order_info.user_id NOT IN (${USERS}))
      AND wt_order_product.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
      AND wt_product_category.repre_category_yn = 'y'
    GROUP BY wt_order_product.product_ocode
  `;
}

function addonOptSQL(start: Date, end: Date): string {
  return `
    SELECT
      wt_order_product.reg_date AS DAY,
      CASE
        WHEN wt_admin.company_nm NOT LIKE '%바잇미%' THEN '위탁'
        WHEN wt_admin.company_nm LIKE '%바잇미%'
             AND wt_product.brand_cd IN (${PB}) THEN 'PB'
        WHEN wt_admin.company_nm LIKE '%바잇미%'
             AND wt_product.brand_cd NOT IN (${PB}) THEN '사입'
        ELSE '미분류'
      END AS part,
      wt_order_product.ocode,
      wt_order_product.product_ocode,
      CASE WHEN wt_order_product.product_ocode = '3454103' THEN 8998
           ELSE opt_cost_price
      END AS opt_amount,
      IFNULL(wt_order_product.allocation_rate, 0) / 100 AS allocation_rate
    FROM wt_order_product_opt
    LEFT JOIN wt_order_product ON wt_order_product.product_ocode = wt_order_product_opt.product_ocode
    LEFT JOIN wt_product       ON wt_order_product.product_cd    = wt_product.product_cd
    LEFT JOIN wt_admin         ON wt_product.supplier            = wt_admin.\`no\`
    WHERE wt_order_product_opt.opt_gb = 'i'
      AND wt_order_product.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
    GROUP BY wt_order_product_opt.product_ocode
  `;
}

export function salesSQL(start: Date, end: Date): string {
  return `
    SELECT
      DATE(DAY) as sale_date,
      HOUR(DAY) as sale_hour,
      ocode, product_ocode, userid, part,
      price - coupon
        - (reserve_raw + IF(trans = 0, 0,
                   IF(trans_reserve = 0, 0,
                      ROUND(trans_reserve * (trans / SUM(trans) OVER (PARTITION BY ocode)), 0)
                   )))
        - (deposit_raw + IF(trans = 0, 0,
                   IF(trans_deposit = 0, 0,
                      ROUND(trans_deposit * (trans / SUM(trans) OVER (PARTITION BY ocode)), 0)
                   )))
        + trans AS net_sales,
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
    FROM (${innerSubquery(start, end)}) AS sub
  `;
}

export function addonOptSalesSQL(start: Date, end: Date): string {
  return addonOptSQL(start, end);
}

export function brandRankingSQL(start: Date, end: Date): string {
  return `
    SELECT
      brand_cd,
      MAX(brand_nm) as brand_nm,
      MAX(part) as part,
      COUNT(DISTINCT ocode) as order_count,
      ROUND(SUM(net_sales)) as total_sales
    FROM (
      SELECT
        brand_cd, brand_nm, part, ocode,
        price - coupon
          - (reserve_raw + IF(trans = 0, 0,
                     IF(trans_reserve = 0, 0,
                        ROUND(trans_reserve * (trans / SUM(trans) OVER (PARTITION BY ocode)), 0)
                     )))
          - (deposit_raw + IF(trans = 0, 0,
                     IF(trans_deposit = 0, 0,
                        ROUND(trans_deposit * (trans / SUM(trans) OVER (PARTITION BY ocode)), 0)
                     )))
          + trans AS net_sales
      FROM (${innerSubquery(start, end)}) AS sub
    ) AS brand_sales
    GROUP BY brand_cd
    HAVING total_sales > 0
  `;
}

export function brandPartMapSQL(): string {
  return `
    SELECT
      wt_product.brand_cd,
      IFNULL(wt_code2.code_nm2, wt_product.brand_cd) AS brand_nm,
      CASE
        WHEN wt_admin.company_nm NOT LIKE '%바잇미%' THEN '위탁'
        WHEN wt_admin.company_nm LIKE '%바잇미%'
             AND wt_product.brand_cd IN (${PB}) THEN 'PB'
        WHEN wt_admin.company_nm LIKE '%바잇미%'
             AND wt_product.brand_cd NOT IN (${PB}) THEN '사입'
        ELSE '미분류'
      END AS part
    FROM wt_product
    LEFT JOIN wt_admin ON wt_product.supplier = wt_admin.\`no\`
    LEFT JOIN wt_code2 ON wt_product.brand_cd = wt_code2.code_cd2
    GROUP BY wt_product.brand_cd
  `;
}

export function productPartMapSQL(): string {
  return `
    SELECT
      wt_product.product_cd AS item_id,
      wt_product.product_nm AS item_name,
      IFNULL(wt_code2.code_nm2, wt_product.brand_cd) AS brand_nm,
      CASE
        WHEN wt_admin.company_nm NOT LIKE '%바잇미%' THEN '위탁'
        WHEN wt_admin.company_nm LIKE '%바잇미%'
             AND wt_product.brand_cd IN (${PB}) THEN 'PB'
        WHEN wt_admin.company_nm LIKE '%바잇미%'
             AND wt_product.brand_cd NOT IN (${PB}) THEN '사입'
        ELSE '미분류'
      END AS part
    FROM wt_product
    LEFT JOIN wt_admin ON wt_product.supplier = wt_admin.\`no\`
    LEFT JOIN wt_code2 ON wt_product.brand_cd = wt_code2.code_cd2
  `;
}

export function productRankingSQL(start: Date, end: Date): string {
  return `
    SELECT
      product_cd,
      MAX(product_nm) as product_nm,
      MAX(part) as part,
      COUNT(DISTINCT ocode) as order_count,
      SUM(qty) as total_qty,
      ROUND(SUM(net_sales)) as total_sales
    FROM (
      SELECT
        product_cd, product_nm, part, ocode, qty,
        price - coupon
          - (reserve_raw + IF(trans = 0, 0,
                     IF(trans_reserve = 0, 0,
                        ROUND(trans_reserve * (trans / SUM(trans) OVER (PARTITION BY ocode)), 0)
                     )))
          - (deposit_raw + IF(trans = 0, 0,
                     IF(trans_deposit = 0, 0,
                        ROUND(trans_deposit * (trans / SUM(trans) OVER (PARTITION BY ocode)), 0)
                     )))
          + trans AS net_sales
      FROM (${innerSubquery(start, end)}) AS sub
    ) AS product_sales
    GROUP BY product_cd
    HAVING total_sales > 0
  `;
}
