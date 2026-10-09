try {
  const status = rs.status();
  if (status.ok) {
    print("Replica set already initialized");
    quit(0);
  }
} catch (e) {
  // not yet initiated
}

const result = rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "127.0.0.1:27017" }],
});

printjson(result);
