export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================================================
    // D1 PARTS API
    // =========================================================

    if (url.pathname === "/api/parts") {
      const code = url.searchParams.get("code");

      if (!code) {
        return Response.json(
          {
            error: "Missing parameter: code"
          },
          {
            status: 400
          }
        );
      }

      const normalizedCode = code
        .toUpperCase()
        .replace(/[-\s]/g, "");

      try {
        const result = await env.DB.prepare(`
          SELECT DISTINCT
            p.id AS part_id,
            p.name AS part_name,
            p.description,
            p.part_type,
            p.quantity_per_vehicle,
            p.requires_coding,

            COALESCE(m.name, 'Unknown') AS manufacturer,

            pn.part_number AS part_number,

            GROUP_CONCAT(
              DISTINCT oe.oe_number
            ) AS oe_numbers,

            GROUP_CONCAT(
              DISTINCT
              COALESCE(eqm.name, 'Unknown')
              || ':' ||
              eqpn.part_number
            ) AS equivalents,

            GROUP_CONCAT(
              DISTINCT
              e.name || ':' ||
              e.engine_code || ':' ||
              e.fuel || ':' ||
              e.displacement_cc || ':' ||
              e.power_hp
            ) AS compatible_engines,

            GROUP_CONCAT(
              DISTINCT vg.name
            ) AS generations,

            MIN(pc.year_from) AS compatible_from,
            MAX(pc.year_to) AS compatible_to

          FROM part_numbers pn

          JOIN parts p
            ON p.id = pn.part_id

          LEFT JOIN manufacturers m
            ON m.id = pn.manufacturer_id

          LEFT JOIN oe_numbers oe
            ON oe.part_id = p.id

          LEFT JOIN part_equivalents pe
            ON pe.part_id = p.id

          LEFT JOIN parts eq
            ON eq.id = pe.equivalent_part_id

          LEFT JOIN manufacturers eqm
            ON eqm.id = eq.manufacturer_id

          LEFT JOIN part_numbers eqpn
            ON eqpn.part_id = eq.id
            AND eqpn.is_primary = 1

          LEFT JOIN part_compatibility pc
            ON pc.part_id = p.id

          LEFT JOIN engines e
            ON e.id = pc.engine_id

          LEFT JOIN vehicle_generations vg
            ON vg.id = e.generation_id

          WHERE UPPER(
            REPLACE(
              REPLACE(
                pn.part_number,
                '-',
                ''
              ),
              ' ',
              ''
            )
          ) = ?

          GROUP BY
            p.id,
            p.name,
            p.description,
            p.part_type,
            p.quantity_per_vehicle,
            p.requires_coding,
            m.name,
            pn.part_number
        `)
          .bind(normalizedCode)
          .all();

        if (!result.results.length) {
          return Response.json(
            {
              found: false,
              query: code,
              results: []
            },
            {
              status: 404
            }
          );
        }

        return Response.json({
          found: true,
          query: code,
          results: result.results
        });

      } catch (error) {
        return Response.json(
          {
            error: "Database query failed",
            message: error.message
          },
          {
            status: 500
          }
        );
      }
    }

    // =========================================================
    // WEBSITE / STATIC FILES
    // =========================================================

    return env.ASSETS.fetch(request);
  }
};
