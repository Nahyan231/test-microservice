curl --location --request POST 'http://127.0.0.1:11222/rest/v2/caches/jazzcash' \
--header 'Content-Type: application/xml' \
--header 'Authorization: Basic YWRtaW46cGFzcw==' \
--data-raw '<infinispan>
<cache-container>
<local-cache name="configuration" statistics="true">
<locking concurrency-level="1000" acquire-timeout="15000" striping="false"/>
<transaction mode="NONE"/>
</local-cache>
</cache-container>
</infinispan>'