#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>

#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    void reverseArray(vector<int>& arr) {
        int n = arr.size();
        for (int i = 0; i < n / 2; i++) {
            swap(arr[i], arr[n - i - 1]);
        }
    }
};



            #include <chrono>

            int main() {
                // Read input once before the loop
                std::string input_str;
                std::string line;
                while (std::getline(std::cin, line)) {
                    input_str += line + "\n";
                }
                
                auto start = std::chrono::high_resolution_clock::now();

                for (int i = 0; i < 100000; ++i) {
                    std::stringstream input_stream(input_str);
                    auto* cin_buf = std::cin.rdbuf(input_stream.rdbuf());

                    
    int n;
    std::cin >> n;
    std::vector<int> arr(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> arr[i];
    }

    Solution sol;
    sol.reverseArray(arr);

    for (int i = 0; i < n; ++i) {
        std::cout << arr[i] << (i == n - 1 ? "" : " ");
    }
    std::cout << std::endl;

    


                    std::cin.rdbuf(cin_buf); // Restore cin
                }

                auto end = std::chrono::high_resolution_clock::now();
                std::chrono::duration<double, std::milli> elapsed = end - start;
                // Output total time, which we will average
                // We are not using this output, but it's good for debugging.
                // std::cout << "Total time: " << elapsed.count() << "ms" << std::endl;
                
                return 0;
            }
        