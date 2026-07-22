def test_schema_objects_exist(db_conn):
    conn, loop = db_conn
    rows = loop.run_until_complete(
        conn.fetch(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'uns_registry'
            ORDER BY table_name
            """
        )
    )
    table_names = {row["table_name"] for row in rows}

    assert table_names == {
        "asset_informational",
        "asset_templates",
        "assets",
        "sync_runtime_state",
        "template_children",
        "template_informational",
    }
