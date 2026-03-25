$ErrorActionPreference = "Stop"

function Assert-Ok($condition, $message) {
  if (-not $condition) {
    throw "SMOKE TEST FAILED: $message"
  }
}

Write-Host "Starting smoke test..." -ForegroundColor Cyan

$baseUi = "http://localhost:8080"
$baseBooking = "http://localhost:5101"
$baseHotel = "http://localhost:5103"
$baseFlight = "http://localhost:5102"
$baseLoyalty = "http://localhost:5105"
$baseNotif = "http://localhost:5106"
$baseGraphql = "http://localhost:5110/graphql"

# 1) Basic endpoint reachability
$ui = Invoke-WebRequest "$baseUi" -UseBasicParsing
Assert-Ok ($ui.StatusCode -eq 200) "UI is not reachable on :8080"

$booking = Invoke-RestMethod "$baseBooking/" -Method GET
Assert-Ok ($booking.message -match "Booking API is running") "Booking root check failed"

$hotel = Invoke-RestMethod "$baseHotel/hotel/search?country=Singapore" -Method GET
Assert-Ok ($hotel.code -eq 200) "Hotel search failed"
Assert-Ok ($hotel.data.Count -gt 0) "Hotel search returned no rows"

$flight = Invoke-RestMethod "$baseFlight/flight/SQ001" -Method GET
Assert-Ok ($flight.code -eq 200) "Flight fetch failed"

$loyalty = Invoke-RestMethod "$baseLoyalty/loyalty/1/points" -Method GET
Assert-Ok ($loyalty.code -eq 200) "Loyalty fetch failed"

$graphqlBody = @{
  query = "query($country:String){ hotelSearch(country:$country){ hotelID name city country } }"
  variables = @{ country = "Singapore" }
} | ConvertTo-Json -Depth 5

$graphql = Invoke-RestMethod "$baseGraphql" -Method POST -ContentType "application/json" -Body $graphqlBody
Assert-Ok ($null -ne $graphql.data.hotelSearch) "GraphQL hotelSearch missing data"
Assert-Ok ($graphql.data.hotelSearch.Count -gt 0) "GraphQL hotelSearch empty"

# 2) Create + cancel booking flow
$createPayload = @{
  customerID = 1
  passengerName = "Smoke Test User"
  passengerEmail = "smoke@example.com"
  passengerPhone = "+65 9000 0000"
  flightID = "SQ001"
  hotelID = 16
  hotelRoomType = "STD"
  hotelIncludesBreakfast = $false
  departureTime = "2026-06-01T10:00"
  totalPrice = 1200
  currency = "SGD"
  fareType = "Flexi"
  seatNumber = "11A"
} | ConvertTo-Json -Depth 6

$create = Invoke-RestMethod "$baseBooking/booking" -Method POST -ContentType "application/json" -Body $createPayload
Assert-Ok ($create.code -eq 200) "Create booking failed"
Assert-Ok ($null -ne $create.data.id) "Create booking returned no ID"
$bookingId = [int]$create.data.id
Write-Host "Created booking id: $bookingId" -ForegroundColor Green

$cancelPayload = @{ cancelSource = "customer" } | ConvertTo-Json
$cancel = Invoke-RestMethod "$baseBooking/booking/cancel/$bookingId" -Method POST -ContentType "application/json" -Body $cancelPayload
Assert-Ok ($cancel.code -eq 200) "Cancel booking failed"

$notif = Invoke-RestMethod "$baseNotif/notifications" -Method GET
Assert-Ok ($notif.code -eq 200) "Notification endpoint failed"

Write-Host "Smoke test passed." -ForegroundColor Green
Write-Host "Tip: Put this command in your demo backup plan:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\smoke_test.ps1"
