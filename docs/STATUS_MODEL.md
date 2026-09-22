# Status model

The database owns final integrity. Application transitions provide early, intentional workflow validation; no UI exposes arbitrary status editing.

## Shipment

| Status     | Meaning                              | Caused by                 | Valid previous | Valid next | Conditions                                                                  |
| ---------- | ------------------------------------ | ------------------------- | -------------- | ---------- | --------------------------------------------------------------------------- |
| `not_sent` | Shipment is being assembled          | Shipment creation         | none           | `sent`     | At least one eligible PackingUnit is atomically assigned                    |
| `sent`     | Vehicle departed                     | `סיום העמסה`              | `not_sent`     | `arrived`  | Transport details valid; all selected units claimed and in transit          |
| `arrived`  | Receiving was finalized              | `אישור סופי` in receiving | `sent`         | `verified` | Arrived units explicitly confirmed; missing units recorded as discrepancies |
| `verified` | Shipment hierarchy is fully verified | Final child distribution  | `arrived`      | none       | Every attached PackingUnit is verified; database trigger is authoritative   |

## PackingUnit

| Status                         | Meaning                                        | Caused by                 | Valid previous                 | Valid next                     | Conditions                                                           |
| ------------------------------ | ---------------------------------------------- | ------------------------- | ------------------------------ | ------------------------------ | -------------------------------------------------------------------- |
| `not_sent`                     | Packed and available for loading               | `אישור אריזה`             | none                           | `assigned_to_shipment`         | Valid scope, type, destination, actor, and Items                     |
| `assigned_to_shipment`         | Reserved for one Shipment                      | Loading transaction       | `not_sent`                     | `in_transit`                   | Unit was still unassigned and eligible at commit time                |
| `in_transit`                   | Physically departed                            | `סיום העמסה`              | `assigned_to_shipment`         | `arrived_pending_verification` | Shipment transitioned to sent                                        |
| `arrived_pending_verification` | Explicitly received, not yet fully distributed | Receiving finalization    | `in_transit`                   | `verified`                     | User explicitly checked the unit as arrived                          |
| `verified`                     | All child Items reached final destination      | Distribution finalization | `arrived_pending_verification` | none                           | Every child Item is verified; DB trigger blocks invalid verification |

## Item

| Status                         | Meaning                                      | Caused by                 | Valid previous                 | Valid next                     | Conditions                                                                             |
| ------------------------------ | -------------------------------------------- | ------------------------- | ------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------- |
| `not_sent`                     | Available inventory                          | import/manual creation    | none                           | `assigned_to_packing_unit`     | Unpacked, eligible, positive quantity                                                  |
| `assigned_to_packing_unit`     | Quantity is reserved inside one unit         | `אישור אריזה`             | `not_sent`                     | `in_transit`                   | Conditional claim succeeds; partial split preserves remainder                          |
| `in_transit`                   | Parent unit departed                         | `סיום העמסה`              | `assigned_to_packing_unit`     | `arrived_pending_verification` | Parent is in transit                                                                   |
| `arrived_pending_verification` | Parent arrived; final quantity not confirmed | receiving finalization    | `in_transit`                   | `verified`                     | Parent was explicitly received                                                         |
| `verified`                     | Full expected quantity reached destination   | distribution finalization | `arrived_pending_verification` | none                           | `distributed_quantity == quantity`; DB guards prevent regression under verified parent |

Packing creation is the pre-`not_sent` transition into an operational unit:
non-personal units claim one or more eligible Items from a completed/mapped
source room; `personal_carton` is the explicit zero-Item exception. Partial
quantities split the source Item transactionally so the remainder stays
`not_sent`.

## Discrepancy lifecycle

`missing` is deliberately not a movement status.

| Status      | Meaning                                         | Valid next                                    |
| ----------- | ----------------------------------------------- | --------------------------------------------- |
| `pending`   | Difference detected before final physical check | `resolved` or `finalized`                     |
| `resolved`  | Recheck corrected the difference                | none                                          |
| `finalized` | User confirmed the shortage after recheck       | operational follow-up outside the current MVP |

Receiving and distribution preview calculations are not persisted as missing. Only `אישור סופי` creates finalized discrepancy rows.
